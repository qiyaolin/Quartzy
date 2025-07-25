from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from funding.models import *
from decimal import Decimal
from datetime import date, timedelta
import uuid

class Command(BaseCommand):
    help = 'Create realistic biology lab financial data for McGill University'

    def handle(self, *args, **options):
        self.stdout.write('Creating biology lab financial data...')
        
        # Get or create admin user
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@mcgill.ca',
                'is_staff': True,
                'is_superuser': True
            }
        )
        
        # Create PI users
        pi1, created = User.objects.get_or_create(
            username='dr_chen',
            defaults={
                'first_name': 'Sarah',
                'last_name': 'Chen',
                'email': 'sarah.chen@mcgill.ca'
            }
        )
        
        pi2, created = User.objects.get_or_create(
            username='dr_rodriguez',
            defaults={
                'first_name': 'Michael',
                'last_name': 'Rodriguez', 
                'email': 'michael.rodriguez@mcgill.ca'
            }
        )
        
        pi3, created = User.objects.get_or_create(
            username='dr_kim',
            defaults={
                'first_name': 'Jennifer',
                'last_name': 'Kim',
                'email': 'jennifer.kim@mcgill.ca'
            }
        )
        
        # Get or create currency
        cad_currency, created = Currency.objects.get_or_create(
            code='CAD',
            defaults={
                'name': 'Canadian Dollar',
                'symbol': '$',
                'exchange_rate_to_cad': Decimal('1.0')
            }
        )
        
        # Create funding agencies
        nserc, created = FundingAgency.objects.get_or_create(
            name='Natural Sciences and Engineering Research Council (NSERC)',
            defaults={
                'agency_type': 'government',
                'contact_person': 'NSERC Program Officer',
                'email': 'info@nserc-crsng.gc.ca',
                'website': 'https://www.nserc-crsng.gc.ca/'
            }
        )
        
        cihr, created = FundingAgency.objects.get_or_create(
            name='Canadian Institutes of Health Research (CIHR)',
            defaults={
                'agency_type': 'government',
                'contact_person': 'CIHR Program Officer',
                'email': 'info@cihr-irsc.gc.ca',
                'website': 'https://cihr-irsc.gc.ca/'
            }
        )
        
        cfi, created = FundingAgency.objects.get_or_create(
            name='Canada Foundation for Innovation (CFI)',
            defaults={
                'agency_type': 'government',
                'contact_person': 'CFI Program Officer',
                'email': 'info@innovation.ca',
                'website': 'https://www.innovation.ca/'
            }
        )
        
        # Create cost centers
        cost_center1, created = CostCenter.objects.get_or_create(
            code='BIO-001',
            defaults={
                'name': 'Molecular Biology Lab',
                'description': 'Research in gene expression and protein synthesis',
                'department': 'Biology Department',
                'manager': pi1
            }
        )
        
        cost_center2, created = CostCenter.objects.get_or_create(
            code='BIO-002',
            defaults={
                'name': 'Cancer Research Lab',
                'description': 'Oncology and tumor biology research',
                'department': 'Biology Department', 
                'manager': pi2
            }
        )
        
        # Create budget categories
        equipment_cat, created = BudgetCategory.objects.get_or_create(
            name='Equipment',
            defaults={'description': 'Laboratory equipment and instrumentation'}
        )
        
        supplies_cat, created = BudgetCategory.objects.get_or_create(
            name='Supplies',
            defaults={'description': 'Consumable laboratory supplies and reagents'}
        )
        
        personnel_cat, created = BudgetCategory.objects.get_or_create(
            name='Personnel',
            defaults={'description': 'Salaries and benefits for research personnel'}
        )
        
        travel_cat, created = BudgetCategory.objects.get_or_create(
            name='Travel',
            defaults={'description': 'Conference travel and research collaboration'}
        )
        
        # Clear existing enhanced funds to avoid duplicates
        EnhancedFund.objects.all().delete()
        FinancialTransaction.objects.all().delete()
        
        # Create realistic enhanced funds for biology lab
        funds_data = [
            {
                'name': 'NSERC Discovery Grant - Molecular Mechanisms of Gene Expression',
                'funding_agency': nserc,
                'principal_investigator': pi1,
                'cost_center': cost_center1,
                'total_budget': Decimal('185000'),
                'spent_amount': Decimal('87500'),
                'committed_amount': Decimal('23000'),
                'start_date': date(2024, 1, 1),
                'end_date': date(2026, 12, 31),
                'grant_number': 'RGPIN-2024-04567',
                'status': 'active'
            },
            {
                'name': 'CIHR Operating Grant - Cancer Cell Metabolism',
                'funding_agency': cihr,
                'principal_investigator': pi2,
                'cost_center': cost_center2,
                'total_budget': Decimal('320000'),
                'spent_amount': Decimal('245000'),
                'committed_amount': Decimal('45000'),
                'start_date': date(2023, 7, 1),
                'end_date': date(2024, 9, 30),
                'grant_number': 'PJT-180456',
                'status': 'active'
            },
            {
                'name': 'CFI Innovation Fund - Advanced Microscopy Facility',
                'funding_agency': cfi,
                'principal_investigator': pi3,
                'cost_center': cost_center1,
                'total_budget': Decimal('150000'),
                'spent_amount': Decimal('98000'),
                'committed_amount': Decimal('35000'),
                'start_date': date(2024, 3, 15),
                'end_date': date(2025, 3, 14),
                'grant_number': 'CFI-41289',
                'status': 'active'
            },
            {
                'name': 'NSERC Collaborative Research - Protein Folding Dynamics',
                'funding_agency': nserc,
                'principal_investigator': pi1,
                'cost_center': cost_center1,
                'total_budget': Decimal('95000'),
                'spent_amount': Decimal('12000'),
                'committed_amount': Decimal('8000'),
                'start_date': date(2024, 6, 1),
                'end_date': date(2027, 5, 31),
                'grant_number': 'RGPCC-2024-00123',
                'status': 'active'
            },
            {
                'name': 'CIHR Catalyst Grant - Immunotherapy Development',
                'funding_agency': cihr,
                'principal_investigator': pi2,
                'cost_center': cost_center2,
                'total_budget': Decimal('75000'),
                'spent_amount': Decimal('68000'),
                'committed_amount': Decimal('5000'),
                'start_date': date(2023, 10, 1),
                'end_date': date(2024, 9, 30),
                'grant_number': 'CAT-156789',
                'status': 'active'
            },
            {
                'name': 'McGill Internal Startup Fund - New Faculty Research',
                'funding_agency': None,
                'principal_investigator': pi3,
                'cost_center': cost_center1,
                'total_budget': Decimal('50000'),
                'spent_amount': Decimal('32000'),
                'committed_amount': Decimal('12000'),
                'start_date': date(2024, 1, 1),
                'end_date': date(2025, 12, 31),
                'grant_number': 'MCGILL-SF-2024-003',
                'status': 'active'
            }
        ]
        
        created_funds = []
        for fund_data in funds_data:
            fund = EnhancedFund.objects.create(
                currency=cad_currency,
                created_by=admin_user,
                description=f"Research fund for {fund_data['name']}",
                **fund_data
            )
            created_funds.append(fund)
            self.stdout.write(f'Created fund: {fund.name}')
        
        # Create realistic financial transactions with better temporal distribution
        transactions_data = [
            # NSERC Discovery Grant transactions - 2024 data
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('15000'),
                'description': 'PCR Thermal Cycler',
                'vendor_name': 'Thermo Fisher Scientific',
                'status': 'processed',
                'transaction_date': date(2024, 2, 15)
            },
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('8500'),
                'description': 'Laboratory reagents and consumables',
                'vendor_name': 'Sigma-Aldrich',
                'status': 'processed',
                'transaction_date': date(2024, 3, 10)
            },
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('25000'),
                'description': 'Graduate student stipend - Q1',
                'vendor_name': 'McGill Payroll',
                'status': 'processed',
                'transaction_date': date(2024, 3, 31)
            },
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('12000'),
                'description': 'Lab supplies - April',
                'vendor_name': 'Sigma-Aldrich',
                'status': 'processed',
                'transaction_date': date(2024, 4, 15)
            },
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('18500'),
                'description': 'Graduate student stipend - Q2',
                'vendor_name': 'McGill Payroll',
                'status': 'processed',
                'transaction_date': date(2024, 6, 30)
            },
            {
                'fund': created_funds[0],
                'transaction_type': 'purchase',
                'amount': Decimal('8500'),
                'description': 'Research chemicals - July',
                'vendor_name': 'Sigma-Aldrich',
                'status': 'processed',
                'transaction_date': date(2024, 7, 8)
            },
            
            # CIHR Operating Grant transactions - spread across months
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('45000'),
                'description': 'Flow cytometer maintenance and calibration',
                'vendor_name': 'BD Biosciences',
                'status': 'processed',
                'transaction_date': date(2024, 1, 20)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('12000'),
                'description': 'Cell culture media and supplements',
                'vendor_name': 'Life Technologies',
                'status': 'processed',
                'transaction_date': date(2024, 2, 5)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('35000'),
                'description': 'Postdoc salary - January',
                'vendor_name': 'McGill Payroll',
                'status': 'processed',
                'transaction_date': date(2024, 1, 31)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('22000'),
                'description': 'Immunofluorescence reagents',
                'vendor_name': 'Abcam',
                'status': 'processed',
                'transaction_date': date(2024, 3, 18)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('35000'),
                'description': 'Postdoc salary - April',
                'vendor_name': 'McGill Payroll',
                'status': 'processed',
                'transaction_date': date(2024, 4, 30)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('15000'),
                'description': 'Cell culture equipment',
                'vendor_name': 'Eppendorf',
                'status': 'processed',
                'transaction_date': date(2024, 5, 12)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('28000'),
                'description': 'Cancer research antibodies',
                'vendor_name': 'Cell Signaling Technology',
                'status': 'processed',
                'transaction_date': date(2024, 6, 8)
            },
            {
                'fund': created_funds[1],
                'transaction_type': 'purchase',
                'amount': Decimal('35000'),
                'description': 'Postdoc salary - July',
                'vendor_name': 'McGill Payroll',
                'status': 'processed',
                'transaction_date': date(2024, 7, 31)
            },
            
            # CFI Innovation Fund transactions - equipment purchases
            {
                'fund': created_funds[2],
                'transaction_type': 'purchase',
                'amount': Decimal('65000'),
                'description': 'Confocal microscope objective lenses',
                'vendor_name': 'Zeiss Canada',
                'status': 'processed',
                'transaction_date': date(2024, 4, 10)
            },
            {
                'fund': created_funds[2],
                'transaction_type': 'purchase',
                'amount': Decimal('18000'),
                'description': 'Microscopy software license',
                'vendor_name': 'ImageJ Pro',
                'status': 'processed',
                'transaction_date': date(2024, 4, 25)
            },
            {
                'fund': created_funds[2],
                'transaction_type': 'purchase',
                'amount': Decimal('15000'),
                'description': 'Microscope maintenance contract',
                'vendor_name': 'Zeiss Canada',
                'status': 'processed',
                'transaction_date': date(2024, 5, 20)
            },
            
            # Additional transactions from other funds
            {
                'fund': created_funds[3],
                'transaction_type': 'purchase',
                'amount': Decimal('6000'),
                'description': 'Protein analysis kits',
                'vendor_name': 'Bio-Rad',
                'status': 'processed',
                'transaction_date': date(2024, 6, 15)
            },
            {
                'fund': created_funds[3],
                'transaction_type': 'purchase',
                'amount': Decimal('6000'),
                'description': 'Research supplies - July',
                'vendor_name': 'VWR',
                'status': 'processed',
                'transaction_date': date(2024, 7, 10)
            },
            
            {
                'fund': created_funds[4],
                'transaction_type': 'purchase',
                'amount': Decimal('22000'),
                'description': 'Immunotherapy research supplies',
                'vendor_name': 'Miltenyi Biotec',
                'status': 'processed',
                'transaction_date': date(2024, 1, 15)
            },
            {
                'fund': created_funds[4],
                'transaction_type': 'purchase',
                'amount': Decimal('18000'),
                'description': 'Flow cytometry panel development',
                'vendor_name': 'BD Biosciences',
                'status': 'processed',
                'transaction_date': date(2024, 2, 28)
            },
            {
                'fund': created_funds[4],
                'transaction_type': 'purchase',
                'amount': Decimal('15000'),
                'description': 'Cell therapy reagents',
                'vendor_name': 'Miltenyi Biotec',
                'status': 'processed',
                'transaction_date': date(2024, 4, 18)
            },
            {
                'fund': created_funds[4],
                'transaction_type': 'purchase',
                'amount': Decimal('13000'),
                'description': 'Clinical trial preparation',
                'vendor_name': 'Thermo Fisher Scientific',
                'status': 'processed',
                'transaction_date': date(2024, 6, 25)
            },
            
            {
                'fund': created_funds[5],
                'transaction_type': 'purchase',
                'amount': Decimal('8000'),
                'description': 'New faculty lab setup',
                'vendor_name': 'VWR',
                'status': 'processed',
                'transaction_date': date(2024, 2, 10)
            },
            {
                'fund': created_funds[5],
                'transaction_type': 'purchase',
                'amount': Decimal('12000'),
                'description': 'Basic lab equipment',
                'vendor_name': 'Eppendorf',
                'status': 'processed',
                'transaction_date': date(2024, 3, 25)
            },
            {
                'fund': created_funds[5],
                'transaction_type': 'purchase',
                'amount': Decimal('12000'),
                'description': 'Research startup supplies',
                'vendor_name': 'Sigma-Aldrich',
                'status': 'processed',
                'transaction_date': date(2024, 5, 8)
            }
        ]
        
        for trans_data in transactions_data:
            trans = FinancialTransaction.objects.create(
                amount_in_fund_currency=trans_data['amount'],
                currency=cad_currency,
                created_by=admin_user,
                **trans_data
            )
            self.stdout.write(f'Created transaction: {trans.description} - ${trans.amount}')
        
        # Create budget allocations for funds
        for fund in created_funds:
            # Equipment allocation (30-40% of budget)
            equipment_allocation = fund.total_budget * Decimal('0.35')
            equipment_spent = fund.spent_amount * Decimal('0.40')  # Equipment tends to be purchased early
            
            EnhancedBudgetAllocation.objects.create(
                fund=fund,
                category=equipment_cat,
                allocated_amount=equipment_allocation,
                spent_amount=min(equipment_spent, equipment_allocation),
                committed_amount=equipment_allocation * Decimal('0.1')
            )
            
            # Supplies allocation (25-30% of budget)  
            supplies_allocation = fund.total_budget * Decimal('0.28')
            supplies_spent = fund.spent_amount * Decimal('0.35')
            
            EnhancedBudgetAllocation.objects.create(
                fund=fund,
                category=supplies_cat,
                allocated_amount=supplies_allocation,
                spent_amount=min(supplies_spent, supplies_allocation),
                committed_amount=supplies_allocation * Decimal('0.05')
            )
            
            # Personnel allocation (35-45% of budget)
            personnel_allocation = fund.total_budget * Decimal('0.42')
            personnel_spent = fund.spent_amount * Decimal('0.50')  # Personnel costs are regular
            
            EnhancedBudgetAllocation.objects.create(
                fund=fund,
                category=personnel_cat,
                allocated_amount=personnel_allocation,
                spent_amount=min(personnel_spent, personnel_allocation),
                committed_amount=personnel_allocation * Decimal('0.2')  # Future salaries committed
            )
            
        self.stdout.write(self.style.SUCCESS('Successfully created biology lab financial data!'))
        self.stdout.write(f'Created {len(created_funds)} enhanced funds')
        self.stdout.write(f'Created {len(transactions_data)} financial transactions')
        self.stdout.write(f'Created budget allocations for all funds')