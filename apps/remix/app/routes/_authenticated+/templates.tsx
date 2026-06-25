import { useState } from 'react';

import { Link } from 'react-router';

const INK = '#262626';

// dotloop-style folder set (recreated for Foraker).
const FOLDERS: { id: string; label: string }[] = [
  { id: 'md-buying', label: 'MD Buying Docs' },
  { id: 'de-buying', label: 'DE Buying Docs' },
  { id: 'docspot', label: 'DOCSPOT' },
  { id: 'pa-buying', label: 'PA Buying Documents' },
  { id: 'pa-listing', label: 'PA Listing Documents' },
  { id: 'master', label: 'Foraker Realty Co Master Documents' },
  { id: 'listing-lease', label: 'Listing Lease Documents' },
  { id: 'lease', label: 'Lease Documents' },
  { id: 'onboarding', label: 'Agent Onboarding Documents' },
  { id: 'de-interactive', label: 'Delaware Interactive Forms' },
  { id: 'de-spanish', label: 'Delaware Spanish Translations' },
  { id: 'nar', label: 'NAR Guides & Resources' },
  { id: 'bright-mls', label: 'Bright MLS Interactive Documents' },
  { id: 'mar', label: 'MAR Interactive Forms' },
  { id: 'par', label: 'PAR Interactive Documents' },
  { id: 'md-rec', label: 'Maryland REC Interactive Forms' },
  { id: 'dar', label: 'DAR Interactive Forms' },
];

type Template = {
  name: string;
  file: string;
  badge: string;
  pages: number;
  desc: string;
  folder: string;
  fillable?: boolean;
};

const TEMPLATES: Template[] = [
  {
    name: 'Right to Farm (Cecil County)',
    file: 'md-right-to-farm-cecil.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-buying',
    desc: 'Cecil County, MD right-to-farm transfer disclosure.',
  },
  {
    name: 'Cecil County Hazardous Waste Sites Addendum',
    file: 'md-cecil-hazardous-waste.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-buying',
    desc: 'Cecil County, MD hazardous waste sites addendum.',
  },
  {
    name: 'Residential Contract of Sale (MAR)',
    file: 'md-residential-contract-mar.pdf',
    badge: 'MD',
    pages: 11,
    fillable: true,
    folder: 'md-buying',
    desc: 'Maryland REALTORS residential contract of sale.',
  },
  {
    name: 'Agreement of Sale for Delaware Residential Property',
    file: 'de-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 10,
    fillable: true,
    folder: 'de-buying',
    desc: 'Delaware Association of REALTORS residential agreement of sale.',
  },
  {
    name: 'ICA \u2014 Foraker Realty Affiliation',
    file: 'ica-foraker-affiliation.pdf',
    badge: 'FRC',
    pages: 6,
    folder: 'docspot',
    desc: 'Independent Contractor Agreement \u2014 Foraker Realty Co affiliation.',
  },
  {
    name: 'Team Addendum to the Independent Contractor Agreement',
    file: 'team-addendum-ica.pdf',
    badge: 'FRC',
    pages: 3,
    folder: 'docspot',
    desc: 'Team addendum to the Foraker independent contractor agreement.',
  },
  {
    name: 'Protect Your Family From Lead in Your Home',
    file: 'protect-your-family-lead.pdf',
    badge: 'EPA',
    pages: 19,
    folder: 'pa-buying',
    desc: 'EPA lead-paint disclosure booklet.',
  },
  {
    name: 'Protect Your Family From Lead in Your Home',
    file: 'protect-your-family-lead.pdf',
    badge: 'EPA',
    pages: 19,
    folder: 'pa-listing',
    desc: 'EPA lead-paint disclosure booklet.',
  },
  {
    name: 'Protect Your Family From Lead in Your Home',
    file: 'protect-your-family-lead.pdf',
    badge: 'EPA',
    pages: 19,
    folder: 'listing-lease',
    desc: 'EPA lead-paint disclosure booklet.',
  },
  {
    name: 'Protect Your Family From Lead in Your Home',
    file: 'protect-your-family-lead.pdf',
    badge: 'EPA',
    pages: 19,
    folder: 'lease',
    desc: 'EPA lead-paint disclosure booklet.',
  },
  {
    name: 'Wire Fraud Notice (PAR WFN)',
    file: 'wire-fraud-notice.pdf',
    badge: 'PA',
    pages: 1,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Wire Fraud Notice (PAR WFN)',
    file: 'wire-fraud-notice.pdf',
    badge: 'PA',
    pages: 1,
    folder: 'pa-listing',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Wire Fraud Notice (PAR WFN)',
    file: 'wire-fraud-notice.pdf',
    badge: 'PA',
    pages: 1,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Wire Fraud Notice (PAR WFN)',
    file: 'wire-fraud-notice.pdf',
    badge: 'PA',
    pages: 1,
    folder: 'lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Buyer (Tenant) Agency Contract (PAR BAC)',
    file: 'buyer-tenant-agency-contract.pdf',
    badge: 'PA',
    pages: 4,
    fillable: true,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Buyer (Tenant) Agency Contract (PAR BAC)',
    file: 'buyer-tenant-agency-contract.pdf',
    badge: 'PA',
    pages: 4,
    fillable: true,
    folder: 'lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: "Buyer's Estimated Costs and Deposit Money Notice",
    file: 'buyers-estimated-costs.pdf',
    badge: 'PA',
    pages: 1,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Consumer Notice (PAR CN) - Buying',
    file: 'consumer-notice-cn-buying.pdf',
    badge: 'PA',
    pages: 2,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Consumer Notice (PAR CNT) - Buying',
    file: 'consumer-notice-cnt-buying.pdf',
    badge: 'PA',
    pages: 2,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: "Consumer's Guide to the Agreement of Sale",
    file: 'consumers-guide-agreement-of-sale.pdf',
    badge: 'PA',
    pages: 31,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: "Consumer's Guide to the Agreement of Sale",
    file: 'consumers-guide-agreement-of-sale.pdf',
    badge: 'PA',
    pages: 31,
    folder: 'pa-listing',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Standard Agreement for the Sale of Real Estate (PAR ASR)',
    file: 'pa-standard-agreement-asr.pdf',
    badge: 'PA',
    pages: 14,
    fillable: true,
    folder: 'pa-buying',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Listing Contract (Seller Agency Contract)',
    file: 'pa-listing-contract-seller-agency.pdf',
    badge: 'PA',
    pages: 7,
    fillable: true,
    folder: 'pa-listing',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Property Description Sheet (PAR XLS-A)',
    file: 'property-description-sheet.pdf',
    badge: 'PA',
    pages: 2,
    folder: 'pa-listing',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: "Seller's Property Disclosure Statement (PAR SPD)",
    file: 'sellers-property-disclosure.pdf',
    badge: 'PA',
    pages: 11,
    folder: 'pa-listing',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Escrow Agreement for Earnest Money Deposit',
    file: 'escrow-agreement-earnest-money.pdf',
    badge: 'FRC',
    pages: 5,
    folder: 'master',
    desc: 'Foraker Realty Co document.',
  },
  {
    name: '24 Hr Showing / Touring Agreement',
    file: 'showing-touring-agreement.pdf',
    badge: 'FRC',
    pages: 1,
    folder: 'master',
    desc: 'Foraker Realty Co document.',
  },
  {
    name: 'Affiliated Business Agreement Disclosure',
    file: 'affiliated-business-disclosure.pdf',
    badge: 'FRC',
    pages: 2,
    folder: 'master',
    desc: 'Foraker Realty Co document.',
  },
  {
    name: 'Foraker Realty Co Important Acknowledgements',
    file: 'foraker-important-acknowledgements.pdf',
    badge: 'FRC',
    pages: 1,
    folder: 'master',
    desc: 'Foraker Realty Co document.',
  },
  {
    name: 'Listing for Rent Contract (Landlord Agency)',
    file: 'listing-for-rent-contract.pdf',
    badge: 'PA',
    pages: 5,
    fillable: true,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Property Description Sheet for Rental (PAR XLS)',
    file: 'property-description-sheet-rental.pdf',
    badge: 'PA',
    pages: 2,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Property Management Agreement (PAR PMA)',
    file: 'property-management-agreement.pdf',
    badge: 'PA',
    pages: 6,
    fillable: true,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Rental Application for Landlord Agents (PAR R)',
    file: 'rental-application-landlord-agents.pdf',
    badge: 'PA',
    pages: 4,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Residential Lease (PAR RL)',
    file: 'residential-lease.pdf',
    badge: 'PA',
    pages: 7,
    fillable: true,
    folder: 'listing-lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Residential Lease (PAR RL)',
    file: 'residential-lease.pdf',
    badge: 'PA',
    pages: 7,
    fillable: true,
    folder: 'lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Rental Application (PAR RA)',
    file: 'rental-application-ra.pdf',
    badge: 'PA',
    pages: 4,
    folder: 'lease',
    desc: 'Pennsylvania Association of REALTORS form.',
  },
  {
    name: 'Condominium Resale Disclosure and Transmittal',
    file: 'mar-condo-resale-disclosure-transmittal.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Condominium Resale Disclosure Certificate',
    file: 'mar-condo-resale-certificate.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Condominium Resale Notice',
    file: 'mar-condo-resale-notice.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Conventional Financing Addendum',
    file: 'mar-conventional-financing-addendum.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Escrow Agreement Between Buyer, Seller, and Escrow Agent',
    file: 'mar-escrow-agreement.pdf',
    badge: 'MD',
    pages: 3,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Exclusive Buyer/Tenant Representation Agreement',
    file: 'mar-exclusive-buyer-tenant-rep.pdf',
    badge: 'MD',
    pages: 5,
    fillable: true,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Exclusive Right to Sell Residential Brokerage Agreement',
    file: 'mar-exclusive-right-to-sell.pdf',
    badge: 'MD',
    pages: 10,
    fillable: true,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Exclusive Right to Sell Unimproved Land',
    file: 'mar-exclusive-right-to-sell-unimproved.pdf',
    badge: 'MD',
    pages: 9,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'FHA Financing Addendum',
    file: 'mar-fha-financing-addendum.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Foreign Investment in Real Property Tax Act',
    file: 'mar-foreign-investment-tax.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Maryland Homeowners Association Act Disclosures',
    file: 'mar-homeowners-assoc-disclosures.pdf',
    badge: 'MD',
    pages: 3,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Maryland Homeowners Association Act Notice',
    file: 'mar-homeowners-assoc-notice.pdf',
    badge: 'MD',
    pages: 3,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'National Priorities List (NPL) Superfund',
    file: 'mar-national-priorities-superfund.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'On-Site Sewage Disposal System (OSDS)',
    file: 'mar-on-site-sewage-disposal.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Owner Financing Contingency Addendum',
    file: 'mar-owner-financing-contingency.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Pet Rent Addendum',
    file: 'mar-pet-rent-addendum.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Maryland Residential Property Disclosure and Disclaimer',
    file: 'mar-residential-property-disclosure-disclaimer.pdf',
    badge: 'MD',
    pages: 4,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Resale of Condominium Unit Acknowledgment',
    file: 'mar-resale-condo-unit-acknowledgment.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: "Seller's Home of Choice Addendum",
    file: 'mar-sellers-home-of-choice.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Water Quality Test Addendum',
    file: 'mar-water-quality-test-addendum.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: 'Water Yield Test Notice',
    file: 'mar-water-yield-test-notice.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'mar',
    desc: 'Maryland REALTORS form.',
  },
  {
    name: "Auditor's Checklist and Reconciliation of Escrow",
    file: 'mrec-auditors-checklist.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: "Renters' Rights & Stabilization Act for Landlords",
    file: 'mrec-renters-rights-stabilization.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Residential Property Disclosure and Disclaimer',
    file: 'mar-residential-property-disclosure-disclaimer.pdf',
    badge: 'MD',
    pages: 4,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Addendum to Agreement of Sale',
    file: 'de-addendum-to-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Addendum to Backup Agreement of Sale',
    file: 'de-addendum-to-backup-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 13,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Agreement of Sale for Vacant Land / Agricultural Property',
    file: 'de-agreement-of-sale-for-vacant-land-agricultural.pdf',
    badge: 'DE',
    pages: 8,
    fillable: true,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Amendment to Exclusive Right to Sell Listing Agreement',
    file: 'de-amendment-to-exclusive-right-to-sell-listing-a.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Appraisal Gap Addendum',
    file: 'de-appraisal-gap-addendum.pdf',
    badge: 'DE',
    pages: 7,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'What is Bright MLS? (MLS Disclosure)',
    file: 'de-what-is-bright-mls-mls-disclosure.pdf',
    badge: 'DE',
    pages: 6,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Broker to Broker Referral Agreement',
    file: 'de-broker-to-broker-referral-agreement.pdf',
    badge: 'DE',
    pages: 9,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Contingency Waiver & Offer Acknowledgement',
    file: 'de-contingency-waiver-offer-acknowledgement.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'COVID-19 Related Delay Addendum',
    file: 'de-covid-19-related-delay-addendum.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'COVID-19 Release & Hold-Harmless Agreement',
    file: 'de-covid-19-release-hold-harmless-agreement.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'DUCIOA Resale Certification',
    file: 'de-ducioa-resale-certification.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Due Diligence Addendum',
    file: 'de-due-diligence-addendum.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Entry Agreement',
    file: 'de-entry-agreement.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Escalation Clause Addendum',
    file: 'de-escalation-clause-addendum.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Exclusive Buyer/Tenant Agency (Representation) Agreement',
    file: 'de-exclusive-buyer-tenant-agency-representation-a.pdf',
    badge: 'DE',
    pages: 4,
    fillable: true,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Exclusive Right to Sell Listing Agreement',
    file: 'de-exclusive-right-to-sell-listing-agreement.pdf',
    badge: 'DE',
    pages: 15,
    fillable: true,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Delaware Form REW-EST (Real Estate Tax Return)',
    file: 'de-delaware-form-rew-est-real-estate-tax-return.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Delaware Residential Landlord-Tenant Code (Summary)',
    file: 'de-delaware-residential-landlord-tenant-code-summ.pdf',
    badge: 'DE',
    pages: 10,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Reservation of Rights Addendum',
    file: 'de-reservation-of-rights-addendum.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Disclosure of Information on Lead-Based Paint (DE)',
    file: 'de-disclosure-of-information-on-lead-based-paint.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Modification to Exclusive Right to Sell Listing Agreement',
    file: 'de-modification-to-exclusive-right-to-sell-listin.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Must Sell Addendum',
    file: 'de-must-sell-addendum.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Mutual Release from Agreement of Sale',
    file: 'de-mutual-release-from-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Pet Addendum',
    file: 'de-pet-addendum.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Pre-Settlement Inspection Acknowledgement',
    file: 'de-pre-settlement-inspection-acknowledgement.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Protect Your Family From Lead in Your Home',
    file: 'de-protect-your-family-from-lead-in-your-home.pdf',
    badge: 'EPA',
    pages: 20,
    folder: 'dar',
    desc: 'EPA lead-paint disclosure booklet.',
  },
  {
    name: 'Purchase Money Mortgage Addendum',
    file: 'de-purchase-money-mortgage-addendum.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'REALTORS & Attorneys Data Sheet',
    file: 'de-realtors-attorneys-data-sheet.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Repair and Maintenance Agreement',
    file: 'de-repair-and-maintenance-agreement.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Residential Lease-Rental Agreement',
    file: 'de-residential-lease-rental-agreement.pdf',
    badge: 'DE',
    pages: 6,
    fillable: true,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Seller Contribution Addendum',
    file: 'de-seller-contribution-addendum.pdf',
    badge: 'DE',
    pages: 1,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: "Seller's Disclosure and Radon Disclosure Exemption",
    file: 'de-seller-s-disclosure-and-radon-disclosure-exemp.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: "Seller's Disclosure of Real Property Condition Report",
    file: 'de-seller-s-disclosure-of-real-property-condition.pdf',
    badge: 'DE',
    pages: 10,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: "Seller's Disclosure of Real Property Condition \u2014 New Construction Only",
    file: 'de-seller-s-disclosure-of-real-property-condition.pdf',
    badge: 'DE',
    pages: 8,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: "Seller's Disclosure of Real Property Condition \u2014 Vacant Land (Residential Use)",
    file: 'de-seller-s-disclosure-of-real-property-condition.pdf',
    badge: 'DE',
    pages: 6,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: "Seller's Reaffirmation of Seller's Disclosure",
    file: 'de-seller-s-reaffirmation-of-seller-s-disclosure.pdf',
    badge: 'DE',
    pages: 3,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Short Sale and REO Acknowledgement',
    file: 'de-short-sale-and-reo-acknowledgement.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Delaware Manufactured Home Lot Lease \u2014 Tenant Rights (DOJ)',
    file: 'de-delaware-manufactured-home-lot-lease-tenant-ri.pdf',
    badge: 'DE',
    pages: 36,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Utility Addendum',
    file: 'de-utility-addendum.pdf',
    badge: 'DE',
    pages: 2,
    folder: 'dar',
    desc: 'Delaware Association of REALTORS form.',
  },
  {
    name: 'Tenants Bill of Rights — Amharic (MREC)',
    file: 'mrec-tenants-bill-of-rights-amharic.pdf',
    badge: 'MD',
    pages: 13,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Arabic (MREC)',
    file: 'mrec-tenants-bill-of-rights-arabic.pdf',
    badge: 'MD',
    pages: 13,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Burmese (MREC)',
    file: 'mrec-tenants-bill-of-rights-burmese.pdf',
    badge: 'MD',
    pages: 24,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Chinese (MREC)',
    file: 'mrec-tenants-bill-of-rights-chinese.pdf',
    badge: 'MD',
    pages: 14,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Dari (MREC)',
    file: 'mrec-tenants-bill-of-rights-dari.pdf',
    badge: 'MD',
    pages: 13,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — English (MREC)',
    file: 'mrec-tenants-bill-of-rights-english.pdf',
    badge: 'MD',
    pages: 14,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — French (MREC)',
    file: 'mrec-tenants-bill-of-rights-french.pdf',
    badge: 'MD',
    pages: 16,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Haitian Creole (MREC)',
    file: 'mrec-tenants-bill-of-rights-haitian-creole.pdf',
    badge: 'MD',
    pages: 15,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Korean (MREC)',
    file: 'mrec-tenants-bill-of-rights-korean.pdf',
    badge: 'MD',
    pages: 15,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Pashto (MREC)',
    file: 'mrec-tenants-bill-of-rights-pashto.pdf',
    badge: 'MD',
    pages: 14,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Russian (MREC)',
    file: 'mrec-tenants-bill-of-rights-russian.pdf',
    badge: 'MD',
    pages: 18,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Spanish (MREC)',
    file: 'mrec-tenants-bill-of-rights-spanish.pdf',
    badge: 'MD',
    pages: 15,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Swahili (MREC)',
    file: 'mrec-tenants-bill-of-rights-swahili.pdf',
    badge: 'MD',
    pages: 16,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Tagalog (MREC)',
    file: 'mrec-tenants-bill-of-rights-tagalog.pdf',
    badge: 'MD',
    pages: 17,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Tigrinya (MREC)',
    file: 'mrec-tenants-bill-of-rights-tigrinya.pdf',
    badge: 'MD',
    pages: 14,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Ukrainian (MREC)',
    file: 'mrec-tenants-bill-of-rights-ukrainian.pdf',
    badge: 'MD',
    pages: 17,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Urdu (MREC)',
    file: 'mrec-tenants-bill-of-rights-urdu.pdf',
    badge: 'MD',
    pages: 14,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Tenants Bill of Rights — Vietnamese (MREC)',
    file: 'mrec-tenants-bill-of-rights-vietnamese.pdf',
    badge: 'MD',
    pages: 16,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Consent for Dual Agency (MREC)',
    file: 'mrec-consent-for-dual-agency.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Home Buyer Tips for Choosing a Real Estate Agent (MREC)',
    file: 'mrec-home-buyer-tips.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Home Seller Tips for Choosing a Real Estate Agent (MREC)',
    file: 'mrec-home-seller-tips.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Notification of Dual Agency Within a Team (MREC)',
    file: 'mrec-notification-dual-agency-team.pdf',
    badge: 'MD',
    pages: 2,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
  {
    name: 'Source of Income Discrimination Laws in Maryland (MREC)',
    file: 'mrec-source-of-income-discrimination.pdf',
    badge: 'MD',
    pages: 1,
    folder: 'md-rec',
    desc: 'Maryland Real Estate Commission form.',
  },
];

const TABS = ['Loops', 'Tasks', 'People', 'Templates'];

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function TemplateCard({ t }: { t: Template }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          {t.badge}
        </span>
        <span className="text-xs text-gray-400">{t.pages} pages</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{t.name}</h3>
      <p className="mt-1 flex-1 text-sm text-gray-500">{t.desc}</p>
      {t.fillable && (
        <span className="mt-3 inline-block w-fit rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          Fillable in a loop
        </span>
      )}
      <div className="mt-4 flex items-center gap-3 text-sm">
        <a
          href={`/templates/${t.file}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          View
        </a>
        <a href={`/templates/${t.file}`} download className="font-semibold" style={{ color: INK }}>
          Download
        </a>
        {t.fillable && (
          <Link to="/loops" className="ml-auto text-xs text-gray-400 hover:text-gray-600">
            Fill in a loop →
          </Link>
        )}
      </div>
    </div>
  );
}

// Forms that ship in multiple languages (same form named "… — <Language>") are
// collapsed into one card with a language dropdown instead of N separate cards.
// Generic: works for any form, not just the Tenants Bill of Rights.
const LANG_RE =
  / — (English|Spanish|French|Chinese|Arabic|Vietnamese|Korean|Tagalog|Russian|Haitian Creole|Amharic|Burmese|Dari|Pashto|Swahili|Tigrinya|Ukrainian|Urdu|Portuguese|Hindi|Japanese|German|Italian|Polish|Farsi|Nepali|Somali)(\s*\([^)]*\))?\s*$/;

function languageOf(name: string): { base: string; lang: string } | null {
  const m = LANG_RE.exec(name);
  if (!m) return null;
  // Re-attach any trailing "(SUFFIX)" so all languages of a form share a base.
  const base = (name.slice(0, m.index) + (m[2] ?? '')).trim();
  return { base, lang: m[1] };
}

function LanguagePickerCard({ base, items }: { base: string; items: Template[] }) {
  const langs = items
    .map((t) => ({ lang: languageOf(t.name)?.lang ?? t.name, file: t.file }))
    .sort((a, b) =>
      a.lang === 'English' ? -1 : b.lang === 'English' ? 1 : a.lang.localeCompare(b.lang),
    );
  const [file, setFile] = useState(langs[0]?.file ?? '');
  const title = base.replace(/\s*\([^)]*\)\s*$/, '');
  const badge = items[0]?.badge ?? '';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          {badge}
        </span>
        <span className="text-xs text-gray-400">{langs.length} languages</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-gray-500">
        Available in {langs.length} languages &mdash; pick one and the form opens.
      </p>
      <label className="mb-1 mt-3 block text-xs font-medium" style={{ color: INK }}>
        Language
      </label>
      <select
        value={file}
        onChange={(e) => setFile(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      >
        {langs.map((l) => (
          <option key={l.file} value={l.file}>
            {l.lang}
          </option>
        ))}
      </select>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <a
          href={`/templates/${file}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          View
        </a>
        <a href={`/templates/${file}`} download className="font-semibold" style={{ color: INK }}>
          Download
        </a>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const counts: Record<string, number> = {};
  for (const t of TEMPLATES) counts[t.folder] = (counts[t.folder] ?? 0) + 1;

  const openLabel = FOLDERS.find((f) => f.id === openFolder)?.label ?? '';
  const folderTemplates = TEMPLATES.filter((t) => t.folder === openFolder);

  // Collapse any multi-language form into a single picker card; everything else
  // (including a form that happens to have just one language) renders normally.
  const folderSingles: Template[] = [];
  const langGroups = new Map<string, Template[]>();
  for (const t of folderTemplates) {
    const v = languageOf(t.name);
    if (v) {
      langGroups.set(v.base, [...(langGroups.get(v.base) ?? []), t]);
    } else {
      folderSingles.push(t);
    }
  }
  const langPickers: { base: string; items: Template[] }[] = [];
  for (const [base, items] of langGroups) {
    if (items.length >= 2) {
      langPickers.push({ base, items });
    } else {
      folderSingles.push(...items);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* dotloop-style tabs */}
      <div className="mb-6 flex items-center gap-8 border-b border-gray-200">
        {TABS.map((tab) => {
          const active = tab === 'Templates';
          if (tab === 'Loops') {
            return (
              <Link
                key={tab}
                to="/loops"
                className="-mb-px border-b-2 border-transparent pb-3 text-sm font-medium text-gray-400 hover:text-gray-600"
              >
                {tab}
              </Link>
            );
          }
          return (
            <span
              key={tab}
              className="-mb-px border-b-2 pb-3 text-sm font-medium"
              style={
                active
                  ? { color: INK, borderColor: INK }
                  : { color: '#9ca3af', borderColor: 'transparent', cursor: 'default' }
              }
              title={active ? undefined : 'Coming soon'}
            >
              {tab}
            </span>
          );
        })}
      </div>

      {openFolder === null ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            Foraker&rsquo;s form library. Click a folder to open it.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOLDERS.map((f) => {
              const n = counts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  onClick={() => setOpenFolder(f.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
                >
                  <FolderIcon className="h-9 w-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{f.label}</span>
                    <span className="text-xs text-gray-400">
                      {n} {n === 1 ? 'form' : 'forms'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setOpenFolder(null)}
            className="mb-3 flex items-center gap-1 text-sm font-semibold"
            style={{ color: INK }}
          >
            ‹ All folders
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FolderIcon className="h-6 w-6 text-gray-400" />
            {openLabel}
          </h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            {folderTemplates.length} {folderTemplates.length === 1 ? 'form' : 'forms'}
          </p>

          {folderTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-sm text-gray-400">
              No forms in this folder yet. Send me the documents and I&rsquo;ll add them here.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folderSingles.map((t) => (
                <TemplateCard key={t.file} t={t} />
              ))}
              {langPickers.map((p) => (
                <LanguagePickerCard key={p.base} base={p.base} items={p.items} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
