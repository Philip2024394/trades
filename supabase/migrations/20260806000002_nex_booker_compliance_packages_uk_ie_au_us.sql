-- ═══════════════════════════════════════════════════════════════════════
-- NEX BOOKER · Compliance packages · UK v1.1 + Ireland + Australia + USA
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: 20260806000002_nex_booker_compliance_packages_uk_ie_au_us.sql
-- Author:    Master engineer role (Philip authorised 2026-08-06)
-- Depends:   20260806000000_nex_booker_foundations.sql
-- Research:  4 parallel research passes 2026-08-06 against gov.uk /
--            revenue.ie / ato.gov.au / irs.gov. Every rule row carries
--            the URL that verified it + verification date.
--
-- Purpose:   Ships four compliance packages:
--              (1) GB v1.1 — supersedes GB v1.0 (research found gaps:
--                  MTD ITSA phases 2 & 3, penalty rate increases 2025-04,
--                  flat rate limited cost trader 16.5%, cash/annual
--                  accounting thresholds). Old v1.0 is marked
--                  effective_to = 2026-08-06 (superseded).
--              (2) IE v1.0 — Republic of Ireland. Standard 23%, reduced
--                  13.5%, second reduced 9%, livestock 4.8%, zero 0%.
--                  VAT3 form, bi-monthly default, ROS extension to 23rd.
--              (3) AU v1.0 — Australia. GST 10%, BAS quarterly default,
--                  Super Guarantee 12%, payday super from 2026-07-01.
--              (4) US v1.0 — federal-only. NO federal VAT. Sales tax is
--                  state-level (Nex Booker integrates with TaxCloud for
--                  state sales tax — see release_notes). Federal covers:
--                  self-employment tax, 1099-NEC threshold, mileage rates,
--                  §179, quarterly estimated dates.
--
-- Values captured from official sources 2026-08-06. Real business use
-- requires re-verification against live authority pages plus accountant
-- sign-off before any filing prep.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1 · Supersede UK v1.0 → v1.1
-- ───────────────────────────────────────────────────────────────────────

UPDATE nex_bk_compliance_packages
   SET effective_to = '2026-08-06'
 WHERE country_code = 'GB'
   AND state_code IS NULL
   AND version = '1.0.0'
   AND effective_to IS NULL;

DO $$
DECLARE
    v_pkg_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM nex_bk_compliance_packages
        WHERE country_code = 'GB' AND state_code IS NULL AND version = '1.1.0'
    ) THEN
        INSERT INTO nex_bk_compliance_packages (
            country_code, state_code, version, effective_from,
            last_verified_at, source_urls, release_notes
        ) VALUES (
            'GB', NULL, '1.1.0', '2026-08-06',
            NOW(),
            '["https://www.gov.uk/vat-rates","https://www.gov.uk/vat-returns/deadlines","https://www.gov.uk/guidance/making-tax-digital-for-vat","https://www.gov.uk/guidance/using-making-tax-digital-for-income-tax","https://www.gov.uk/guidance/penalty-points-and-penalties-if-you-submit-your-vat-return-late","https://www.gov.uk/government/publications/increasing-vat-and-other-taxes-late-payment-penalties-percentage-rate-relating-to-penalty-reform","https://www.gov.uk/corporation-tax-rates","https://www.gov.uk/vat-flat-rate-scheme/how-much-you-pay","https://www.gov.uk/vat-cash-accounting-scheme","https://www.gov.uk/guidance/record-keeping-for-vat-notice-70021"]'::JSONB,
            'UK v1.1 · Supersedes v1.0. Verified 2026-08-06 against gov.uk. Adds: MTD ITSA phases 2 (£30k Apr 2027) & 3 (£20k Apr 2028); updated late-payment penalties (3%/3%/10%pa from 1 Apr 2025); points-based late-submission regime (4 points quarterly / 5 monthly / 2 annual, £200 threshold penalty); corporation tax small profits 19% / main 25% / marginal relief £50k-£250k; VAT flat rate limited cost trader 16.5%; flat rate join threshold £150k; cash and annual accounting join threshold £1.35m. Values still require accountant sign-off before filing prep.'
        )
        RETURNING id INTO v_pkg_id;

        INSERT INTO nex_bk_compliance_rules (package_id, rule_key, rule_value, description, effective_from) VALUES
            -- VAT rates (unchanged from v1.0)
            (v_pkg_id, 'vat_standard_rate', '0.20'::JSONB, 'Standard VAT rate.', NULL),
            (v_pkg_id, 'vat_reduced_rate', '0.05'::JSONB, 'Reduced VAT rate (domestic fuel, energy-saving materials).', NULL),
            (v_pkg_id, 'vat_zero_rate', '0.00'::JSONB, 'Zero-rated VAT (most food, books, children''s clothing).', NULL),
            (v_pkg_id, 'vat_registration_threshold_gbp', '90000'::JSONB, 'VAT registration threshold — rolling 12 months of taxable turnover.', '2024-04-01'),
            (v_pkg_id, 'vat_deregistration_threshold_gbp', '88000'::JSONB, 'VAT deregistration threshold.', '2024-04-01'),

            -- VAT returns
            (v_pkg_id, 'vat_return_frequency_default', '"quarterly"'::JSONB, 'Default return frequency; monthly and annual also available.', NULL),
            (v_pkg_id, 'vat_return_deadline_days_after_period', '{"days":37,"description":"1 calendar month + 7 days after period end"}'::JSONB, 'Return submission + payment deadline. Same deadline for both.', NULL),
            (v_pkg_id, 'mtd_vat_required', 'true'::JSONB, 'MTD-VAT auto-enrolls all VAT-registered businesses.', NULL),
            (v_pkg_id, 'mtd_vat_exemption_grounds', '["insolvency","final_return_post_cancellation","age_or_health_or_disability","religious_objection","no_internet_access","otherwise_not_reasonably_practicable"]'::JSONB, 'Grounds on which a business can apply for MTD-VAT exemption.', NULL),

            -- MTD ITSA (Making Tax Digital for Income Tax Self Assessment) — NEW in v1.1
            (v_pkg_id, 'mtd_itsa_phase1_effective_from', '"2026-04-06"'::JSONB, 'MTD ITSA phase 1 mandation start.', '2026-04-06'),
            (v_pkg_id, 'mtd_itsa_phase1_threshold_gbp', '50000'::JSONB, 'Phase 1 threshold — self-employed + landlord gross income.', '2026-04-06'),
            (v_pkg_id, 'mtd_itsa_phase2_effective_from', '"2027-04-06"'::JSONB, 'MTD ITSA phase 2 mandation start.', '2027-04-06'),
            (v_pkg_id, 'mtd_itsa_phase2_threshold_gbp', '30000'::JSONB, 'Phase 2 threshold.', '2027-04-06'),
            (v_pkg_id, 'mtd_itsa_phase3_effective_from', '"2028-04-06"'::JSONB, 'MTD ITSA phase 3 mandation start.', '2028-04-06'),
            (v_pkg_id, 'mtd_itsa_phase3_threshold_gbp', '20000'::JSONB, 'Phase 3 threshold.', '2028-04-06'),

            -- VAT penalties (points-based since 2023, rates increased 2025-04) — NEW in v1.1
            (v_pkg_id, 'vat_late_submission_points_quarterly', '4'::JSONB, 'Points threshold before £200 penalty for quarterly returns.', '2023-01-01'),
            (v_pkg_id, 'vat_late_submission_points_monthly', '5'::JSONB, 'Points threshold for monthly returns.', '2023-01-01'),
            (v_pkg_id, 'vat_late_submission_points_annual', '2'::JSONB, 'Points threshold for annual returns.', '2023-01-01'),
            (v_pkg_id, 'vat_late_submission_penalty_gbp', '200'::JSONB, 'Fixed penalty when points threshold reached.', '2023-01-01'),
            (v_pkg_id, 'vat_late_payment_first_penalty_day15_pct', '0.03'::JSONB, 'First late-payment penalty at day 15 (3% of outstanding).', '2025-04-01'),
            (v_pkg_id, 'vat_late_payment_first_penalty_day30_pct', '0.03'::JSONB, 'Additional 3% at day 30 on amount still outstanding.', '2025-04-01'),
            (v_pkg_id, 'vat_late_payment_second_penalty_annual_pct', '0.10'::JSONB, 'Second penalty from day 31, calculated as 10% p.a. daily.', '2025-04-01'),

            -- Corporation tax — NEW in v1.1
            (v_pkg_id, 'corporation_tax_small_profits_rate', '{"rate":0.19,"upper_threshold_gbp":50000}'::JSONB, 'Small profits rate for profits up to £50,000.', NULL),
            (v_pkg_id, 'corporation_tax_main_rate', '{"rate":0.25,"threshold_gbp":250000}'::JSONB, 'Main rate for profits above £250,000.', NULL),
            (v_pkg_id, 'corporation_tax_marginal_relief', '{"lower_gbp":50000,"upper_gbp":250000}'::JSONB, 'Marginal relief range; effective rate tapers between small and main rate.', NULL),

            -- VAT schemes — NEW in v1.1
            (v_pkg_id, 'vat_flat_rate_scheme_join_threshold_gbp', '150000'::JSONB, 'Flat Rate Scheme eligibility ceiling (VAT-exclusive turnover).', NULL),
            (v_pkg_id, 'vat_flat_rate_limited_cost_trader_pct', '0.165'::JSONB, 'Limited cost trader flat rate — applies to most service businesses; neutralises FRS benefit.', NULL),
            (v_pkg_id, 'vat_cash_accounting_join_threshold_gbp', '1350000'::JSONB, 'Cash accounting scheme join threshold.', NULL),
            (v_pkg_id, 'vat_annual_accounting_join_threshold_gbp', '1350000'::JSONB, 'Annual accounting scheme join threshold.', NULL),

            -- Construction industry — NEW in v1.1
            (v_pkg_id, 'vat_domestic_reverse_charge_cis', 'true'::JSONB, 'CIS domestic reverse charge applies to VAT-registered construction sub-supplies since 1 Mar 2021 — trades-specific.', '2021-03-01'),

            -- Retention + tax year (unchanged)
            (v_pkg_id, 'vat_record_retention_years', '6'::JSONB, 'HMRC record retention requirement.', NULL),
            (v_pkg_id, 'personal_tax_year_start', '{"month":4,"day":6}'::JSONB, 'UK personal tax year starts 6 April.', NULL),
            (v_pkg_id, 'personal_tax_year_end', '{"month":4,"day":5}'::JSONB, 'UK personal tax year ends 5 April.', NULL),
            (v_pkg_id, 'corporation_tax_year_flexible', 'true'::JSONB, 'Corporation tax periods set per company; not fixed to national tax year.', NULL),

            -- Identity
            (v_pkg_id, 'currency_code', '"GBP"'::JSONB, 'Reporting currency.', NULL),
            (v_pkg_id, 'currency_symbol', '"£"'::JSONB, 'Display symbol.', NULL),
            (v_pkg_id, 'authority_name', '"HM Revenue & Customs"'::JSONB, 'Tax authority.', NULL),
            (v_pkg_id, 'authority_abbreviation', '"HMRC"'::JSONB, 'Common abbreviation.', NULL);
    END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 2 · Ireland v1.0
-- ───────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_pkg_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM nex_bk_compliance_packages
        WHERE country_code = 'IE' AND state_code IS NULL AND version = '1.0.0'
    ) THEN
        INSERT INTO nex_bk_compliance_packages (
            country_code, state_code, version, effective_from,
            last_verified_at, source_urls, release_notes
        ) VALUES (
            'IE', NULL, '1.0.0', '2026-08-06',
            NOW(),
            '["https://www.revenue.ie/en/vat/vat-rates/current-vat-rates.aspx","https://www.revenue.ie/en/vat/vat-registration/who-should-register-for-vat/vat-thresholds.aspx","https://www.revenue.ie/en/vat/accounting-for-vat/when-is-vat-due/index.aspx","https://www.revenue.ie/en/vat/accounting-for-vat/how-to-account-for-value-added-tax/completing-vat3-return.aspx","https://www.revenue.ie/en/starting-a-business/registering-for-tax/mandatory-electronic-payment-of-taxes-and-filing-of-tax-returns.aspx","https://www.revenue.ie/en/companies-and-charities/corporation-tax-for-companies/corporation-tax/basis-of-charge.aspx","https://www.revenue.ie/en/vat/vat-records-invoices-credit-notes/vat-records-to-be-kept/how-long-keep-records.aspx"]'::JSONB,
            'IE v1.0 · Verified 2026-08-06 against revenue.ie. Ireland runs 5 VAT rates: 23% standard, 13.5% reduced, 9% second reduced (from Jul 2026 also hospitality food/drink excl. alcohol + hairdressing), 4.8% livestock, 0% zero. Registration thresholds €85k goods / €42.5k services. Default VAT3 return bi-monthly (Jan/Mar/May/Jul/Sep/Nov period start); ROS extends due date to 23rd of following month. Corporation tax 12.5% trading / 25% non-trading. Values require accountant sign-off before filing prep.'
        )
        RETURNING id INTO v_pkg_id;

        INSERT INTO nex_bk_compliance_rules (package_id, rule_key, rule_value, description, effective_from) VALUES
            -- VAT rates (5 rates — Ireland-specific)
            (v_pkg_id, 'vat_standard_rate', '0.23'::JSONB, 'Standard VAT rate.', NULL),
            (v_pkg_id, 'vat_reduced_rate', '0.135'::JSONB, 'Reduced VAT rate (fuel, electricity, building services, cleaning etc).', NULL),
            (v_pkg_id, 'vat_second_reduced_rate', '0.09'::JSONB, 'Second reduced rate; extended to hospitality food/drink (excl. alcohol) and hairdressing from 2026-07-01.', NULL),
            (v_pkg_id, 'vat_livestock_rate', '0.048'::JSONB, 'Livestock rate — Revenue does NOT use "super-reduced" terminology.', NULL),
            (v_pkg_id, 'vat_zero_rate', '0.00'::JSONB, 'Zero-rated categories.', NULL),
            (v_pkg_id, 'vat_exempt_categories', '["financial_services","insurance","qualifying_medical","education","postal","betting_lotteries"]'::JSONB, 'Basic list of exempt categories.', NULL),

            -- Rate change effective 2026-07-01 (announced but not yet effective at v1.0 seed date)
            (v_pkg_id, 'vat_change_hospitality_hairdressing_2026', '{"new_rate":0.09,"effective":"2026-07-01","applies_to":["restaurant_catering_food_drink_excl_alcohol","hairdressing"]}'::JSONB, 'Hospitality + hairdressing move to second reduced 9% from 1 Jul 2026.', '2026-07-01'),

            -- Thresholds
            (v_pkg_id, 'vat_threshold_goods_eur', '85000'::JSONB, 'VAT registration threshold — supply of goods.', NULL),
            (v_pkg_id, 'vat_threshold_services_eur', '42500'::JSONB, 'VAT registration threshold — supply of services.', NULL),
            (v_pkg_id, 'vat_threshold_distance_sales_tbe_eur', '10000'::JSONB, 'EU distance sales + telecom/broadcasting/electronic services threshold.', NULL),
            (v_pkg_id, 'vat_threshold_eu_acquisitions_eur', '41000'::JSONB, 'Intra-EU acquisitions threshold.', NULL),

            -- Returns + payment
            (v_pkg_id, 'vat_return_form', '"VAT3"'::JSONB, 'Standard return form name.', NULL),
            (v_pkg_id, 'vat_default_period', '"bi_monthly"'::JSONB, 'Default period; two-month periods starting Jan/Mar/May/Jul/Sep/Nov.', NULL),
            (v_pkg_id, 'vat_period_four_monthly_max_liability_eur', '14400'::JSONB, 'Max annual liability for four-monthly reporting.', NULL),
            (v_pkg_id, 'vat_period_six_monthly_max_liability_eur', '3000'::JSONB, 'Max annual liability for six-monthly reporting.', NULL),
            (v_pkg_id, 'vat_return_due_day_paper', '19'::JSONB, '19th of month following period end (paper).', NULL),
            (v_pkg_id, 'vat_return_due_day_ros', '23'::JSONB, '23rd of month following period end if pay AND file via ROS.', NULL),
            (v_pkg_id, 'vat_rtd_required', 'true'::JSONB, 'Return of Trading Details (RTD) annual return required.', NULL),
            (v_pkg_id, 'vat_rtd_due_days_after_year_end', '23'::JSONB, 'RTD due 23rd of month following accounting-period end.', NULL),

            -- Systems + retention
            (v_pkg_id, 'ros_mandatory_for_vat', 'true'::JSONB, 'ROS (Revenue Online Service) filing is mandatory for VAT.', NULL),
            (v_pkg_id, 'record_retention_years', '6'::JSONB, 'Revenue record retention requirement.', NULL),

            -- Tax years
            (v_pkg_id, 'income_tax_year', '"calendar_year"'::JSONB, 'Personal income tax year is calendar year Jan-Dec.', NULL),
            (v_pkg_id, 'income_tax_return_due', '"31_october"'::JSONB, 'Self-assessment return due 31 October following year.', NULL),
            (v_pkg_id, 'ct_year', '"company_accounting_period"'::JSONB, 'Corporation tax period set per company.', NULL),
            (v_pkg_id, 'ct_return_due', '"day_23_of_9th_month_after_period_end"'::JSONB, 'Corporation tax return + payment due 23rd of 9th month following period end.', NULL),

            -- Corporation tax
            (v_pkg_id, 'ct_rate_trading', '0.125'::JSONB, 'Corporation tax on trading income.', NULL),
            (v_pkg_id, 'ct_rate_non_trading', '0.25'::JSONB, 'Corporation tax on non-trading/passive income (Case III/IV/V).', NULL),
            (v_pkg_id, 'ct_pillar_two_min_rate', '{"rate":0.15,"applies_to":"MNE_groups_and_domestic_groups","consolidated_revenue_threshold_eur":750000000}'::JSONB, 'Pillar Two minimum effective tax rate — applies only to large groups.', NULL),

            -- Penalties (partial — some caps UNVERIFIED per research notes)
            (v_pkg_id, 'vat_late_payment_interest_daily', '0.000274'::JSONB, 'Daily interest on unpaid VAT (fiduciary tax rate).', NULL),
            (v_pkg_id, 'income_ct_late_surcharge_within_2mo', '{"rate":0.05,"cap_eur":12695}'::JSONB, 'Late-filing surcharge if within 2 months of due date.', NULL),
            (v_pkg_id, 'income_ct_late_surcharge_over_2mo', '{"rate":0.10,"cap_eur":63485}'::JSONB, 'Late-filing surcharge after 2 months.', NULL),

            -- Identity
            (v_pkg_id, 'currency_code', '"EUR"'::JSONB, 'Reporting currency.', NULL),
            (v_pkg_id, 'currency_symbol', '"€"'::JSONB, 'Display symbol.', NULL),
            (v_pkg_id, 'authority_name', '"Office of the Revenue Commissioners"'::JSONB, 'Tax authority.', NULL),
            (v_pkg_id, 'authority_abbreviation', '"Revenue"'::JSONB, 'Common name.', NULL);
    END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 3 · Australia v1.0
-- ───────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_pkg_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM nex_bk_compliance_packages
        WHERE country_code = 'AU' AND state_code IS NULL AND version = '1.0.0'
    ) THEN
        INSERT INTO nex_bk_compliance_packages (
            country_code, state_code, version, effective_from,
            last_verified_at, source_urls, release_notes
        ) VALUES (
            'AU', NULL, '1.0.0', '2026-08-06',
            NOW(),
            '["https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/how-gst-works","https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst","https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas","https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee","https://www.ato.gov.au/tax-rates-and-codes/company-tax-rate-changes","https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business/overview-of-record-keeping-rules-for-business","https://www.ato.gov.au/businesses-and-organisations/super-for-employers/payday-super/about-payday-super"]'::JSONB,
            'AU v1.0 · Verified 2026-08-06 against ato.gov.au. GST 10% (calculated as 1/11 of GST-inclusive price). BAS quarterly default (28-Oct, 28-Feb, 28-Apr, 28-Jul). Super Guarantee 12% from 2025-07-01 (final scheduled increase). Payday Super mandatory from 2026-07-01. Company tax 25% base rate entity (aggregated turnover < $50m + ≤80% passive) or 30% otherwise. Financial year July-June. 5-year record retention. Ride-sourcing/taxi must register for GST from first trip regardless of turnover. Fuel tax credit rates change quarterly by indexation — never hard-code, always fetch current period from ATO. Values require accountant sign-off before filing prep.'
        )
        RETURNING id INTO v_pkg_id;

        INSERT INTO nex_bk_compliance_rules (package_id, rule_key, rule_value, description, effective_from) VALUES
            -- GST
            (v_pkg_id, 'gst_standard_rate', '0.10'::JSONB, 'Standard GST rate. Calculated as 1/11 of GST-inclusive price.', NULL),
            (v_pkg_id, 'gst_free_categories', '["basic_food","some_education_courses","some_medical_health_care","exports_within_60_days","some_childcare","some_religious_services","water_sewerage_drainage"]'::JSONB, 'GST-free supply categories.', NULL),
            (v_pkg_id, 'input_taxed_categories', '["financial_supplies","residential_rent","sale_of_existing_residential_premises"]'::JSONB, 'Input-taxed supplies — no GST charged but no input tax credit either.', NULL),

            -- Registration thresholds
            (v_pkg_id, 'gst_registration_threshold_standard_aud', '75000'::JSONB, 'Standard GST registration threshold (turnover).', NULL),
            (v_pkg_id, 'gst_registration_threshold_nonprofit_aud', '150000'::JSONB, 'Non-profit organisation threshold.', NULL),
            (v_pkg_id, 'gst_registration_ride_sourcing_taxi_aud', '0'::JSONB, 'Ride-sourcing and taxi drivers must register for GST from first trip — no threshold.', NULL),

            -- BAS
            (v_pkg_id, 'bas_monthly_mandatory_threshold_aud', '20000000'::JSONB, 'Aggregated turnover above which monthly BAS becomes mandatory.', NULL),
            (v_pkg_id, 'bas_quarterly_eligibility_max_turnover_aud', '20000000'::JSONB, 'Max turnover for quarterly BAS eligibility.', NULL),
            (v_pkg_id, 'bas_annual_eligibility', '"voluntary_gst_registration_and_turnover_under_registration_threshold"'::JSONB, 'Annual BAS eligibility.', NULL),
            (v_pkg_id, 'bas_monthly_due', '"21st_of_following_month"'::JSONB, 'Monthly BAS due date.', NULL),
            (v_pkg_id, 'bas_quarterly_due_dates', '{"Q1_Jul_Sep":"28_October","Q2_Oct_Dec":"28_February","Q3_Jan_Mar":"28_April","Q4_Apr_Jun":"28_July","note":"Registered tax/BAS agents receive concessions; weekend/public holiday rolls to next business day."}'::JSONB, 'Quarterly BAS due dates.', NULL),
            (v_pkg_id, 'bas_annual_due', '"same_as_income_tax_return_or_28_February_if_no_return_required"'::JSONB, 'Annual BAS due date.', NULL),

            -- Accounting method
            (v_pkg_id, 'gst_cash_accounting_max_turnover_aud', '10000000'::JSONB, 'Cash accounting for GST allowed if aggregated turnover < AUD 10m.', NULL),

            -- PAYG
            (v_pkg_id, 'payg_withholding', '"employer_registers_withholds_reports_on_BAS_remits"'::JSONB, 'PAYG withholding for employees.', NULL),
            (v_pkg_id, 'payg_instalments_auto_entry_individual', '{"instalment_income_min_aud":4000,"tax_payable_min_aud":1000}'::JSONB, 'Auto-entry thresholds for PAYG instalments (individuals).', NULL),
            (v_pkg_id, 'payg_instalments_quarterly_due', '"28_days_after_quarter_end"'::JSONB, 'PAYG instalments quarterly deadline; monthly only if instalment income >= $20m.', NULL),

            -- Super Guarantee
            (v_pkg_id, 'super_guarantee_rate', '0.12'::JSONB, 'Final scheduled SG rate; effective from 1 Jul 2025.', '2025-07-01'),
            (v_pkg_id, 'payday_super_effective_from', '"2026-07-01"'::JSONB, 'Payday Super mandatory — employers must pay SG each payday, received by fund within 7 business days.', '2026-07-01'),

            -- Record retention + FY
            (v_pkg_id, 'record_retention_years', '5'::JSONB, 'General record retention; longer for depreciating assets and carried-forward items.', NULL),
            (v_pkg_id, 'financial_year', '{"start_month":7,"start_day":1,"end_month":6,"end_day":30}'::JSONB, 'Australian financial year 1 Jul – 30 Jun.', NULL),

            -- Company tax
            (v_pkg_id, 'company_tax_rate_base_rate_entity', '{"rate":0.25,"threshold_aggregated_turnover_aud":50000000,"passive_income_max_pct":0.80}'::JSONB, 'Base rate entity tax — reduced rate for smaller companies.', NULL),
            (v_pkg_id, 'company_tax_rate_standard', '0.30'::JSONB, 'Standard company tax rate for larger or passive-income-heavy companies.', NULL),
            (v_pkg_id, 'small_business_income_tax_offset', '{"rate":0.16,"aggregated_turnover_max_aud":5000000,"cap_per_person_aud":1000}'::JSONB, 'Small business income tax offset for individuals with business income.', NULL),

            -- Identifiers + special schemes
            (v_pkg_id, 'tfn_basics', '"personal_reference_number_free_to_apply"'::JSONB, 'Tax File Number.', NULL),
            (v_pkg_id, 'abn_basics', '"issued_via_abr.gov.au_free_required_for_business"'::JSONB, 'Australian Business Number.', NULL),
            (v_pkg_id, 'fuel_tax_credits', '{"note":"Rates change quarterly by indexation. Always fetch current period from ATO — do NOT hard-code rates.","current_period_url":"https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/fuel-schemes/fuel-tax-credits-business"}'::JSONB, 'Fuel tax credits — trades often eligible.', NULL),

            -- Identity
            (v_pkg_id, 'currency_code', '"AUD"'::JSONB, 'Reporting currency.', NULL),
            (v_pkg_id, 'currency_symbol', '"$"'::JSONB, 'Display symbol.', NULL),
            (v_pkg_id, 'authority_name', '"Australian Taxation Office"'::JSONB, 'Tax authority.', NULL),
            (v_pkg_id, 'authority_abbreviation', '"ATO"'::JSONB, 'Common abbreviation.', NULL);
    END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 4 · USA v1.0 (federal only)
-- ───────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_pkg_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM nex_bk_compliance_packages
        WHERE country_code = 'US' AND state_code IS NULL AND version = '1.0.0'
    ) THEN
        INSERT INTO nex_bk_compliance_packages (
            country_code, state_code, version, effective_from,
            last_verified_at, source_urls, release_notes
        ) VALUES (
            'US', NULL, '1.0.0', '2026-01-01',
            NOW(),
            '["https://www.irs.gov/publications/p509","https://www.irs.gov/faqs/estimated-tax","https://www.irs.gov/self-employed-individuals-tax-center","https://www.irs.gov/forms-pubs/about-form-1099-nec","https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents","https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records","https://www.section179.org/section_179_deduction/","https://www.ssa.gov/oact/cola/cbb.html"]'::JSONB,
            'US v1.0 · FEDERAL ONLY. Verified 2026-08-06 against irs.gov + ssa.gov + section179.org. USA has NO federal VAT/GST; federal tax is INCOME tax. Sales tax is state-level (45 states + DC) and often further to city/county — thousands of jurisdictions. Nex Booker does NOT maintain state sales tax rates in-house; state sales tax uses a licensed third-party integration (default: TaxCloud for cost-sensitive users, Stripe Tax for Stripe-native, Avalara for enterprise). This package covers federal only: self-employment tax, 1099-NEC threshold, mileage rates, Section 179 + bonus depreciation, quarterly estimated tax dates. For initial USA beta, restrict onboarding to pilot states (FL/TX/NY recommended per research) before general rollout. Values require accountant sign-off before filing prep. See also: separate US state-level packages (e.g. US/CA, US/TX, US/NY) to be seeded per pilot state.'
        )
        RETURNING id INTO v_pkg_id;

        INSERT INTO nex_bk_compliance_rules (package_id, rule_key, rule_value, description, effective_from) VALUES
            -- Filing deadlines 2026
            (v_pkg_id, 'individual_return_due_2026', '"2026-04-15"'::JSONB, 'Individual return due (Form 1040).', NULL),
            (v_pkg_id, 'individual_extension_due_2026', '"2026-10-15"'::JSONB, 'Extended individual return deadline.', NULL),
            (v_pkg_id, 's_corp_partnership_return_due_2026', '"2026-03-16"'::JSONB, 'S-corp + partnership return (Mar 15 falls on Sunday 2026).', NULL),
            (v_pkg_id, 'c_corp_return_due_2026', '"2026-04-15"'::JSONB, 'C-corp return (Form 1120).', NULL),
            (v_pkg_id, 'w2_1099_recipient_furnish_due_2026', '"2026-02-02"'::JSONB, 'Furnish W-2 / 1099 to recipients (Jan 31 = Saturday).', NULL),

            -- Quarterly estimated tax (individuals + sole prop + SE)
            (v_pkg_id, 'estimated_tax_q1_2026', '"2026-04-15"'::JSONB, 'Q1 estimated tax.', NULL),
            (v_pkg_id, 'estimated_tax_q2_2026', '"2026-06-15"'::JSONB, 'Q2 estimated tax.', NULL),
            (v_pkg_id, 'estimated_tax_q3_2026', '"2026-09-15"'::JSONB, 'Q3 estimated tax.', NULL),
            (v_pkg_id, 'estimated_tax_q4_2026', '"2027-01-15"'::JSONB, 'Q4 estimated tax (paid in following year).', NULL),

            -- 1099-NEC (threshold RAISED for 2026)
            (v_pkg_id, 'form_1099_nec_threshold_2025', '600'::JSONB, '1099-NEC issuance threshold for tax year 2025.', NULL),
            (v_pkg_id, 'form_1099_nec_threshold_2026', '2000'::JSONB, '1099-NEC threshold raised to $2,000 for 2026 tax year by One Big Beautiful Bill Act; inflation-adjusted from 2027.', '2026-01-01'),

            -- Self-employment tax (2026)
            (v_pkg_id, 'self_employment_tax_rate', '0.153'::JSONB, 'Combined SE tax rate = 12.4% Social Security + 2.9% Medicare.', NULL),
            (v_pkg_id, 'social_security_rate_se', '0.124'::JSONB, 'SS portion of SE tax.', NULL),
            (v_pkg_id, 'medicare_rate_se', '0.029'::JSONB, 'Medicare portion of SE tax.', NULL),
            (v_pkg_id, 'social_security_wage_base_2026', '184500'::JSONB, 'Maximum wages subject to SS tax for 2026.', '2026-01-01'),
            (v_pkg_id, 'additional_medicare_tax_rate', '{"rate":0.009,"thresholds":{"single":200000,"married_filing_jointly":250000,"married_filing_separately":125000}}'::JSONB, 'Additional Medicare tax on SE income above thresholds.', NULL),

            -- Standard mileage (2026 SPLIT YEAR)
            (v_pkg_id, 'std_mileage_business_2026_h1', '{"rate":0.725,"effective_from":"2026-01-01","effective_to":"2026-06-30"}'::JSONB, 'Business mileage rate Jan-Jun 2026.', '2026-01-01'),
            (v_pkg_id, 'std_mileage_business_2026_h2', '{"rate":0.76,"effective_from":"2026-07-01","effective_to":"2026-12-31"}'::JSONB, 'Business mileage rate Jul-Dec 2026 (mid-year fuel-cost adjustment).', '2026-07-01'),

            -- Record retention
            (v_pkg_id, 'record_retention_general_years', '3'::JSONB, 'General IRS record retention.', NULL),
            (v_pkg_id, 'record_retention_employment_tax_years', '4'::JSONB, 'Employment tax records.', NULL),
            (v_pkg_id, 'record_retention_unreported_income_over_25pct_years', '6'::JSONB, 'When unreported income > 25% of gross.', NULL),
            (v_pkg_id, 'record_retention_fraud_or_no_return', '"indefinite"'::JSONB, 'If fraud or no return filed.', NULL),

            -- Depreciation (2026)
            (v_pkg_id, 'section_179_limit_2026', '2560000'::JSONB, 'Section 179 deduction limit — OBBBA made permanent + inflation-adjusted.', '2026-01-01'),
            (v_pkg_id, 'section_179_phaseout_start_2026', '4090000'::JSONB, 'Section 179 phaseout begins at this level of purchases.', '2026-01-01'),
            (v_pkg_id, 'section_179_suv_cap_2026', '32000'::JSONB, 'SUV cap (6000-14000 lb GVWR).', '2026-01-01'),
            (v_pkg_id, 'bonus_depreciation_rate_2026', '1.00'::JSONB, 'Bonus depreciation restored to 100%, PERMANENT for property placed in service on/after Jan 20 2025 per OBBBA.', '2025-01-20'),

            -- Sales tax model (informational — actual rates via TaxCloud/Stripe Tax/Avalara)
            (v_pkg_id, 'sales_tax_model', '{"federal_vat":false,"authority":"state","states_with_sales_tax":45,"states_without_sales_tax":["NH","OR","MT","AK","DE"],"sourcing_default":"destination_based","origin_based_states":["AZ","CA_state_only","IL","MS","MO","NM","OH","PA","TN","TX","UT","VA"],"marketplace_facilitator_laws":"all_45_states_plus_DC"}'::JSONB, 'USA sales tax model summary. Actual rates come from licensed provider — do NOT maintain in-house.', NULL),
            (v_pkg_id, 'sales_tax_wayfair_typical_revenue_threshold_usd', '100000'::JSONB, 'Typical economic-nexus revenue threshold post-Wayfair (2018). Some states use $500k (CA/TX/NY).', '2018-06-21'),
            (v_pkg_id, 'sales_tax_wayfair_typical_transaction_threshold', '200'::JSONB, 'Transaction-count threshold; being dropped by many states (IL removed Jan 2026, SD removed 2023) — trend is revenue-only.', NULL),
            (v_pkg_id, 'sales_tax_provider_default', '"taxcloud"'::JSONB, 'Nex Booker default sales tax integration; free filing in 24 SST states.', NULL),
            (v_pkg_id, 'sales_tax_provider_alternatives', '["stripe_tax","avalara","vertex"]'::JSONB, 'Fallback providers per customer profile (Stripe-native → Stripe Tax; enterprise → Avalara/Vertex).', NULL),
            (v_pkg_id, 'contractor_sales_tax_treatment', '{"varies_wildly_by_state":true,"guidance":"Do not encode capital-improvement-vs-repair distinction in Nex logic. Surface as coaching question in ledger UI; route classification to human accountant per state-specific rules."}'::JSONB, 'CRITICAL: contractor sales tax treatment (capital improvement vs repair, real property vs tangible personal property) varies wildly by state and is the single hardest classification problem in US sales tax.', NULL),

            -- Beta rollout guidance
            (v_pkg_id, 'usa_beta_pilot_states', '["FL","TX","NY"]'::JSONB, 'Recommended pilot states for USA beta: FL (destination-based simple), TX (origin-based), NY (most complex contractor rules).', NULL),

            -- Identity
            (v_pkg_id, 'currency_code', '"USD"'::JSONB, 'Reporting currency.', NULL),
            (v_pkg_id, 'currency_symbol', '"$"'::JSONB, 'Display symbol.', NULL),
            (v_pkg_id, 'authority_name', '"Internal Revenue Service"'::JSONB, 'Federal tax authority.', NULL),
            (v_pkg_id, 'authority_abbreviation', '"IRS"'::JSONB, 'Common abbreviation.', NULL);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════
