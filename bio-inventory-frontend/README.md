# Quartzy Frontend - React TypeScript Application

Modern React frontend for the Quartzy Bio-Inventory Management System.

## 🛠️ Setup

### Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Environment Configuration

Create a `.env` file in the frontend root:

```env
REACT_APP_API_BASE_URL=http://localhost:8000/api
REACT_APP_APP_NAME=Quartzy
REACT_APP_VERSION=1.0.0
```

### 3. Start Development Server

```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:3000`

## 🏗️ Build for Production

```bash
npm run build
# or
yarn build
```

This creates an optimized production build in the `build/` directory.

## 🧪 Testing

```bash
# Run tests
npm test
# or
yarn test

# Run tests with coverage
npm test -- --coverage
# or
yarn test --coverage
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── common/         # Common UI elements
│   ├── inventory/      # Inventory-specific components
│   ├── requests/       # Request management components
│   ├── funding/        # Funding and budget components
│   └── notifications/  # Notification components
├── pages/              # Page-level components
│   ├── InventoryPage.tsx
│   ├── RequestsPage.tsx
│   ├── FundingPage.tsx
│   ├── ReportsPage.tsx
│   ├── SettingsPage.tsx
│   └── LoginPage.tsx
├── modals/             # Modal components
│   ├── ItemFormModal.tsx
│   ├── RequestFormModal.tsx
│   ├── BatchFundSelectionModal.tsx
│   └── BatchReceivedModal.tsx
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── NotificationContext.tsx
├── hooks/              # Custom React hooks
│   ├── useApi.ts
│   ├── useAuth.ts
│   └── useNotifications.ts
├── utils/              # Utility functions
│   ├── api.ts          # API client
│   ├── auth.ts         # Authentication utilities
│   ├── formatting.ts   # Data formatting
│   └── excelExport.ts  # Excel export functionality
├── types/              # TypeScript type definitions
│   ├── api.ts
│   ├── auth.ts
│   └── common.ts
└── styles/             # CSS and styling
    ├── globals.css
    └── components/
```

## 🎨 Styling and Theming

The application uses **Tailwind CSS** for styling with support for:

- **Light Theme**: Default light color scheme
- **Dark Theme**: Dark color scheme for reduced eye strain
- **Auto Theme**: Follows system preference

### Theme Configuration

Themes can be switched in the Settings page or programmatically:

```typescript
import { useTheme } from '../contexts/ThemeContext';

const { theme, setTheme } = useTheme();
setTheme('dark'); // 'light' | 'dark' | 'auto'
```

### Custom CSS Classes

Common utility classes are defined in `src/styles/globals.css`:

```css
.btn-primary { @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded; }
.card { @apply bg-white dark:bg-gray-800 rounded-lg shadow-md p-6; }
.input { @apply border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2; }
```

## 🔌 API Integration

### API Client

The application uses a centralized API client (`src/utils/api.ts`):

```typescript
import { apiClient } from '../utils/api';

// GET request
const items = await apiClient.get('/items/');

// POST request
const newItem = await apiClient.post('/items/', itemData);

// Authentication is handled automatically
```

### Authentication

Authentication is managed through the `AuthContext`:

```typescript
import { useAuth } from '../contexts/AuthContext';

const { user, login, logout, isAuthenticated } = useAuth();

// Login
await login(username, password);

// Logout
logout();
```

## 📱 Responsive Design

The application is fully responsive and optimized for:

- **Desktop**: Full feature set with sidebar navigation
- **Tablet**: Adapted layout with collapsible sidebar
- **Mobile**: Mobile-first design with bottom navigation

### Breakpoints

Tailwind CSS breakpoints used:

- `sm`: 640px and up
- `md`: 768px and up  
- `lg`: 1024px and up
- `xl`: 1280px and up

## 🌍 Internationalization

The application supports multiple languages:

- **English** (default)
- **French**
- **Chinese**

### Adding Translations

1. Add translation keys to `src/locales/`:

```typescript
// src/locales/en.ts
export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete'
  }
};
```

2. Use translations in components:

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <button>{t('common.save')}</button>;
```

## 🔔 Notifications

The notification system provides real-time feedback:

```typescript
import { useNotifications } from '../hooks/useNotifications';

const { showNotification } = useNotifications();

showNotification({
  type: 'success',
  title: 'Item Saved',
  message: 'The item has been successfully saved.'
});
```

### Notification Types

- `success`: Green notification for successful actions
- `error`: Red notification for errors
- `warning`: Yellow notification for warnings
- `info`: Blue notification for informational messages

## 📊 Data Visualization

Charts and analytics are implemented using modern charting libraries:

```typescript
import { EnhancedDataVisualization } from '../components/common/EnhancedDataVisualization';

<EnhancedDataVisualization
  data={chartData}
  type="line"
  title="Budget Usage Over Time"
/>
```

## 🔍 Search and Filtering

Advanced search and filtering capabilities:

```typescript
import { useSearch } from '../hooks/useSearch';

const { searchTerm, setSearchTerm, filteredData } = useSearch(data, ['name', 'category']);
```

## 📤 Data Export

Excel export functionality:

```typescript
import { exportToExcel } from '../utils/excelExport';

const handleExport = () => {
  exportToExcel(data, 'inventory-report.xlsx', {
    sheetName: 'Inventory',
    headers: ['Name', 'Category', 'Quantity', 'Expiry Date']
  });
};
```

## 🚀 Performance Optimization

### Code Splitting

Routes are lazy-loaded for better performance:

```typescript
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
```

### Memoization

Use React.memo and useMemo for expensive operations:

```typescript
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => 
    processLargeDataset(data), [data]
  );
  
  return <div>{processedData}</div>;
});
```

## 🔧 Development Tools

### ESLint Configuration

```json
{
  "extends": [
    "react-app",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

## 🌐 Environment Variables

Available environment variables:

- `REACT_APP_API_BASE_URL`: Backend API URL
- `REACT_APP_APP_NAME`: Application name
- `REACT_APP_VERSION`: Application version
- `REACT_APP_ENABLE_ANALYTICS`: Enable analytics (true/false)

## 🐛 Common Issues

### CORS Errors
Ensure the backend `CORS_ALLOWED_ORIGINS` includes your frontend URL.

### Authentication Issues
Check that the API token is properly stored and included in requests.

### Build Errors
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Styling Issues
Ensure Tailwind CSS is properly configured and built.

## 📈 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚀 Deployment

### Static Hosting (Netlify, Vercel)

```bash
npm run build
# Deploy the build/ directory
```

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-specific Builds

Create environment-specific `.env` files:

- `.env.development`
- `.env.staging`  
- `.env.production`

---

**Happy Coding!** ⚛️✨