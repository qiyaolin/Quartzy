from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db import transaction
import pandas as pd
import io
from datetime import datetime, date
import re
from .models import Request, RequestHistory
from .serializers import RequestSerializer
from items.models import Vendor, ItemType
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

class EnhancedRequestImportMixin:
    """
    Enhanced import functionality for Requests with improved data processing
    similar to Inventory import strategy
    """
    
    def clean_price_field(self, price_value):
        """Clean price field by removing currency symbols and converting to float"""
        if pd.isna(price_value):
            return None
        
        price_str = str(price_value).strip()
        if not price_str or price_str.lower() in ['nan', 'none', '']:
            return None
        
        # Remove currency symbols and commas
        price_str = re.sub(r'[$,€£¥]', '', price_str)
        
        try:
            return float(price_str)
        except (ValueError, TypeError):
            return None
    
    def parse_date_field(self, date_value):
        """Parse date field with multiple format support"""
        if pd.isna(date_value):
            return None
        
        if isinstance(date_value, (date, datetime)):
            return date_value.date() if isinstance(date_value, datetime) else date_value
        
        date_str = str(date_value).strip()
        if not date_str or date_str.lower() in ['nan', 'none', '']:
            return None
        
        # Try multiple date formats
        date_formats = [
            '%m/%d/%Y',    # MM/DD/YYYY
            '%d/%m/%Y',    # DD/MM/YYYY
            '%Y-%m-%d',    # YYYY-MM-DD
            '%m-%d-%Y',    # MM-DD-YYYY
            '%d-%m-%Y',    # DD-MM-YYYY
            '%Y/%m/%d',    # YYYY/MM/DD
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        return None
    
    def find_or_create_user(self, user_identifier):
        """Find user by various identifiers or create mapping"""
        if not user_identifier or str(user_identifier).strip().lower() in ['nan', 'none', '']:
            return None
        
        user_str = str(user_identifier).strip()
        
        # Try different user matching strategies
        try:
            # 1. Try exact username match
            return User.objects.get(username=user_str)
        except User.DoesNotExist:
            pass
        
        try:
            # 2. Try email match
            return User.objects.get(email=user_str)
        except User.DoesNotExist:
            pass
        
        try:
            # 3. Try first_name + last_name combination
            name_parts = user_str.split()
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = ' '.join(name_parts[1:])
                return User.objects.get(first_name__iexact=first_name, last_name__iexact=last_name)
        except User.DoesNotExist:
            pass
        
        try:
            # 4. Try partial name matching
            users = User.objects.filter(
                first_name__icontains=name_parts[0] if name_parts else user_str
            )
            if users.count() == 1:
                return users.first()
        except:
            pass
        
        # If no user found, return None (will use current user as default)
        return None
    
    def normalize_status(self, status_value):
        """Normalize status values"""
        if pd.isna(status_value):
            return 'NEW'
        
        status_str = str(status_value).strip().upper()
        
        # Map common status variations
        status_mapping = {
            'NEW': 'NEW',
            'PENDING': 'NEW',
            'APPROVED': 'APPROVED',
            'APPROVE': 'APPROVED',
            'ORDERED': 'ORDERED',
            'ORDER': 'ORDERED',
            'RECEIVED': 'RECEIVED',
            'RECEIVE': 'RECEIVED',
            'COMPLETED': 'RECEIVED',
            'REJECTED': 'REJECTED',
            'REJECT': 'REJECTED',
            'CANCELLED': 'CANCELLED',
            'CANCEL': 'CANCELLED',
        }
        
        return status_mapping.get(status_str, 'NEW')
    
    def detect_header_row(self, df):
        """Detect the actual header row in the DataFrame"""
        header_indicators = [
            'item name', 'item_name', 'product', 'material',
            'requested by', 'requester', 'user',
            'unit price', 'price', 'cost',
            'quantity', 'qty', 'amount'
        ]
        
        for idx, row in df.iterrows():
            row_str = ' '.join([str(val).lower() for val in row.dropna().values])
            if any(indicator in row_str for indicator in header_indicators):
                return idx
        
        return None
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def enhanced_import_data(self, request):
        """
        Enhanced import requests data from Excel/CSV file with improved processing
        """
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        try:
            # Read file based on extension
            if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
                df = pd.read_excel(io.BytesIO(file.read()))
            elif file.name.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file.read()))
            else:
                return Response({'error': 'Unsupported file format. Please use Excel (.xlsx/.xls) or CSV (.csv)'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"Read file with {len(df)} rows and {len(df.columns)} columns")
            
            # Detect header row automatically
            header_row = self.detect_header_row(df)
            
            if header_row is not None:
                # Use the detected row as header
                df.columns = df.iloc[header_row]
                df = df.iloc[header_row + 1:].reset_index(drop=True)
                logger.info(f"Using row {header_row + 1} as header")
            
            # Clean column names
            df.columns = df.columns.astype(str).str.strip()
            
            # Create column mapping for flexible field matching
            column_mapping = {}
            for col in df.columns:
                col_lower = col.lower().strip()
                
                # Map item name variations
                if any(keyword in col_lower for keyword in ['item name', 'item_name', 'product', 'material']):
                    column_mapping['item_name'] = col
                
                # Map requested by variations
                elif any(keyword in col_lower for keyword in ['requested by', 'requested_by', 'requester', 'user']):
                    column_mapping['requested_by'] = col
                
                # Map price variations
                elif any(keyword in col_lower for keyword in ['unit price', 'unit_price', 'price', 'cost']):
                    column_mapping['unit_price'] = col
                
                # Map quantity variations
                elif any(keyword in col_lower for keyword in ['quantity', 'qty', 'amount']):
                    column_mapping['quantity'] = col
                
                # Map vendor variations
                elif any(keyword in col_lower for keyword in ['vendor', 'supplier', 'company']):
                    column_mapping['vendor'] = col
                
                # Map catalog number variations
                elif any(keyword in col_lower for keyword in ['catalog', 'catalog_number', 'part_number', 'part number']):
                    column_mapping['catalog_number'] = col
                
                # Map unit size variations
                elif any(keyword in col_lower for keyword in ['unit size', 'unit_size', 'size', 'package']):
                    column_mapping['unit_size'] = col
                
                # Map URL variations
                elif any(keyword in col_lower for keyword in ['url', 'link', 'website']):
                    column_mapping['url'] = col
                
                # Map status variations
                elif any(keyword in col_lower for keyword in ['status', 'state']):
                    column_mapping['status'] = col
                
                # Map notes variations
                elif any(keyword in col_lower for keyword in ['notes', 'comment', 'remark']):
                    column_mapping['notes'] = col
                
                # Map barcode variations
                elif any(keyword in col_lower for keyword in ['barcode', 'bar_code']):
                    column_mapping['barcode'] = col
                
                # Map fund variations
                elif any(keyword in col_lower for keyword in ['fund', 'fund_id', 'funding']):
                    column_mapping['fund_id'] = col
                
                # Map date variations
                elif any(keyword in col_lower for keyword in ['request date', 'date', 'created']):
                    column_mapping['request_date'] = col
            
            logger.info(f"Column mapping: {column_mapping}")
            
            imported_count = 0
            errors = []
            warnings = []
            
            for idx, row in df.iterrows():
                try:
                    with transaction.atomic():
                        # Skip empty rows
                        item_name_col = column_mapping.get('item_name')
                        if not item_name_col or pd.isna(row.get(item_name_col)) or str(row.get(item_name_col)).strip() == '':
                            continue
                        
                        # Extract and clean item name
                        item_name = str(row.get(item_name_col, '')).strip()
                        if not item_name:
                            errors.append(f'Row {idx + 1}: Item name is required')
                            continue
                        
                        # Parse vendor with get_or_create strategy
                        vendor = None
                        vendor_col = column_mapping.get('vendor')
                        if vendor_col and pd.notna(row.get(vendor_col)):
                            vendor_name = str(row.get(vendor_col)).strip()
                            if vendor_name and vendor_name.lower() != 'nan':
                                vendor, created = Vendor.objects.get_or_create(
                                    name=vendor_name,
                                    defaults={'description': f'Auto-created from import: {vendor_name}'}
                                )
                                if created:
                                    warnings.append(f'Row {idx + 1}: Created new vendor "{vendor_name}"')
                        
                        # Parse requested_by user with enhanced matching
                        requested_by = request.user  # Default to current user
                        requested_by_col = column_mapping.get('requested_by')
                        if requested_by_col and pd.notna(row.get(requested_by_col)):
                            user_identifier = str(row.get(requested_by_col)).strip()
                            found_user = self.find_or_create_user(user_identifier)
                            if found_user:
                                requested_by = found_user
                            else:
                                warnings.append(f'Row {idx + 1}: User "{user_identifier}" not found, using current user')
                        
                        # Parse numeric fields with proper cleaning
                        quantity = 1
                        quantity_col = column_mapping.get('quantity')
                        if quantity_col and pd.notna(row.get(quantity_col)):
                            try:
                                quantity = float(row.get(quantity_col))
                                if quantity <= 0:
                                    quantity = 1
                                    warnings.append(f'Row {idx + 1}: Invalid quantity, using default value 1')
                            except (ValueError, TypeError):
                                warnings.append(f'Row {idx + 1}: Invalid quantity format, using default value 1')
                        
                        # Parse unit price with currency cleaning
                        unit_price = None
                        unit_price_col = column_mapping.get('unit_price')
                        if unit_price_col:
                            unit_price = self.clean_price_field(row.get(unit_price_col))
                            if unit_price is None:
                                errors.append(f'Row {idx + 1}: Unit price is required and must be a valid number')
                                continue
                        else:
                            errors.append(f'Row {idx + 1}: Unit price column not found')
                            continue
                        
                        # Parse status with normalization
                        status_value = 'NEW'
                        status_col = column_mapping.get('status')
                        if status_col and pd.notna(row.get(status_col)):
                            status_value = self.normalize_status(row.get(status_col))
                        
                        # Parse optional fields
                        catalog_number = None
                        catalog_col = column_mapping.get('catalog_number')
                        if catalog_col and pd.notna(row.get(catalog_col)):
                            catalog_number = str(row.get(catalog_col)).strip()
                        
                        unit_size = None
                        unit_size_col = column_mapping.get('unit_size')
                        if unit_size_col and pd.notna(row.get(unit_size_col)):
                            unit_size = str(row.get(unit_size_col)).strip()
                        
                        url = None
                        url_col = column_mapping.get('url')
                        if url_col and pd.notna(row.get(url_col)):
                            url_value = str(row.get(url_col)).strip()
                            if url_value and url_value.lower() != 'nan':
                                url = url_value
                        
                        notes = None
                        notes_col = column_mapping.get('notes')
                        if notes_col and pd.notna(row.get(notes_col)):
                            notes = str(row.get(notes_col)).strip()
                        
                        barcode = None
                        barcode_col = column_mapping.get('barcode')
                        if barcode_col and pd.notna(row.get(barcode_col)):
                            barcode_value = str(row.get(barcode_col)).strip()
                            if barcode_value and barcode_value.lower() != 'nan':
                                barcode = barcode_value
                        
                        fund_id = None
                        fund_col = column_mapping.get('fund_id')
                        if fund_col and pd.notna(row.get(fund_col)):
                            try:
                                fund_id = int(float(row.get(fund_col)))
                            except (ValueError, TypeError):
                                warnings.append(f'Row {idx + 1}: Invalid fund ID format')
                        
                        # Create request with validated data
                        request_data = {
                            'item_name': item_name,
                            'requested_by': requested_by,
                            'unit_price': unit_price,
                            'quantity': int(quantity),
                            'status': status_value,
                        }
                        
                        # Add optional fields if they exist
                        if vendor:
                            request_data['vendor'] = vendor
                        if catalog_number:
                            request_data['catalog_number'] = catalog_number
                        if unit_size:
                            request_data['unit_size'] = unit_size
                        if url:
                            request_data['url'] = url
                        if notes:
                            request_data['notes'] = notes
                        if barcode:
                            request_data['barcode'] = barcode
                        if fund_id:
                            request_data['fund_id'] = fund_id
                        
                        # Create the request
                        new_request = Request.objects.create(**request_data)
                        imported_count += 1
                        
                        logger.info(f"Successfully imported request {new_request.id}: {item_name}")
                        
                except Exception as e:
                    error_msg = str(e)
                    if 'duplicate key value violates unique constraint' in error_msg and 'barcode' in error_msg:
                        errors.append(f'Row {idx + 1} ({item_name}): Request with barcode "{barcode}" already exists')
                    else:
                        errors.append(f'Row {idx + 1}: {error_msg}')
                    logger.error(f"Error importing row {idx + 1}: {error_msg}")
                    continue
            
            # Prepare response
            response_data = {
                'imported_count': imported_count,
                'total_rows': len(df),
                'success': True,
                'column_mapping': column_mapping,
            }
            
            if errors:
                response_data['errors'] = errors[:20]  # Limit to first 20 errors
                response_data['total_errors'] = len(errors)
            
            if warnings:
                response_data['warnings'] = warnings[:20]  # Limit to first 20 warnings
                response_data['total_warnings'] = len(warnings)
            
            logger.info(f"Import completed: {imported_count} imported, {len(errors)} errors, {len(warnings)} warnings")
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Import failed: {str(e)}")
            return Response({'error': f'Failed to process file: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)