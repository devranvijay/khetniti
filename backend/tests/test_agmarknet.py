from datetime import date

import pytest

from app.reference import match_mandi
from scripts.fetch_agmarknet_history import to_rows


@pytest.mark.parametrize(
    "name, expected",
    [
        ("APMC Pimpalgaon Baswant ", "pimpalgaon"),
        ("Pune APMC", "pune"),
        ("APMC Ahilyanagar", "ahmednagar"),
        ("Mumbai-Onion & Potato Market ", "mumbai"),
        ("Lasalgaon", "lasalgaon"),
        # sub-yards are separate markets with their own prices
        ("Lasalgaon(Vinchur)", None),
        ("Pune(Manjri)", None),
        ("Pimpalgaon Baswant(Saykheda) ", None),
        # private markets that only mention the district
        ("Shri Rameshwar Krushi Market, M.Nagar, Tal Deola, Dist Nashik", None),
        ("Omchatinya Multi State Agro Purpose Co-Op Society, Dist Ahilyanagar", None),
        ("APMC Satana ", None),
    ],
)
def test_match_mandi_counts_only_main_yards(name, expected):
    assert match_mandi(name) == expected


def _rec(market, modal, day="25/11/2026", lo="1000", hi="2000", variety="Other"):
    return {"Arrival_Date": day, "Market": market, "Variety": variety, "Min_Price": lo, "Max_Price": hi, "Modal_Price": modal}


def test_to_rows_averages_varieties_and_keeps_app_mandis_only():
    records = [
        _rec("APMC Pimpalgaon Baswant ", "1500", variety="Red"),
        _rec("APMC Pimpalgaon Baswant ", "1700", variety="Local", lo="1200", hi="2200"),
        _rec("Lasalgaon(Vinchur)", "9999"),  # sub-yard: dropped
        _rec("APMC Satana ", "9999"),  # not an app mandi: dropped
        _rec("Pune APMC", "not a number"),  # unusable price: dropped
        _rec("Pune APMC", "1800", day="24/11/2026"),
    ]
    rows = sorted(to_rows(records, "onion"), key=lambda r: (r["date"], r["market_id"]))

    assert [(r["date"], r["market_id"]) for r in rows] == [(date(2026, 11, 24), "pune"), (date(2026, 11, 25), "pimpalgaon")]
    pimpalgaon = rows[1]
    assert pimpalgaon["modal_price"] == 1600
    assert pimpalgaon["min_price"] == 1100
    assert pimpalgaon["max_price"] == 2100
    assert all(r["is_demo"] is False and r["commodity"] == "onion" for r in rows)


def test_to_rows_handles_no_matching_records():
    assert to_rows([_rec("APMC Satana ", "1000")], "onion") == []


@pytest.mark.parametrize("name, expected", [("APMC Nasik", "nashik"), ("APMC Sinner", "sinnar")])
def test_match_mandi_accepts_agmarknet_spellings(name, expected):
    assert match_mandi(name) == expected


AGMARKNET_REPORT = """,,,,,All Type of Report (All Grades) for 01-Jan-2026 to 25-Nov-2026,,,,
State/UT,District,Market,Commodity Group,Commodity,Date,Arrival Quantity 01-01-2026 to 25-11-2026,Arrival Unit,Modal Price 01-01-2026 to 25-11-2026,Price Unit
Maharashtra,Nashik,APMC Lasalgaon ,Vegetables,Onion,01-01-2026,9481.30,Metric Tonnes,1184.00,Rs./Quintal
Maharashtra,Nashik,APMC Nasik ,Vegetables,Onion,02-01-2026,100.00,Metric Tonnes,1000.00,Rs./Quintal
Maharashtra,Nashik,Lasalgaon(Vinchur),Vegetables,Onion,01-01-2026,50.00,Metric Tonnes,9999.00,Rs./Quintal
Maharashtra,Nashik,APMC Nasik ,Vegetables,Tomato,02-01-2026,10.00,Metric Tonnes,800.00,Rs./Quintal

Note:
Weighted Average Price = sum(arrival quantity * modal price) / sum arrival quantity
"""


def test_load_csv_reads_agmarknet_all_type_report(tmp_path):
    from scripts.import_agmarknet_csv import load_csv

    path = tmp_path / "report.csv"
    path.write_text(AGMARKNET_REPORT, encoding="utf-8")
    df = load_csv(str(path), "onion").sort_values("date").reset_index(drop=True)

    assert list(df["market_id"]) == ["lasalgaon", "nashik"]  # sub-yard and the tomato row are left out
    assert list(df["date"]) == [date(2026, 1, 1), date(2026, 1, 2)]
    assert list(df["modal_price"]) == [1184.0, 1000.0]
    assert list(df["arrivals_tonnes"]) == [9481.3, 100.0]


def test_load_csv_rejects_a_file_without_the_crop(tmp_path):
    from scripts.import_agmarknet_csv import load_csv

    path = tmp_path / "report.csv"
    path.write_text(AGMARKNET_REPORT, encoding="utf-8")
    with pytest.raises(SystemExit, match="Potato"):
        load_csv(str(path), "potato")
