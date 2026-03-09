import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import {
    Download,
    RefreshCw,
    PlusCircle,
    FileText,
    Upload,
    Loader,
    AlertTriangle,
    Package,
    Clock,
    CheckCircle2,
    DollarSign,
    ArrowRight,
    TrendingUp,
    Activity,
    Beaker,
    ShieldAlert,
    PackageOpen,
    Sparkles
} from 'lucide-react';
import { AuthContext } from '../components/AuthContext.tsx';
import { exportMultiSheetExcel } from '../utils/excelExport.ts';
import { buildApiUrl, API_ENDPOINTS } from '../config/api.ts';

type ActivityFilter = 'ALL' | 'NEW' | 'APPROVED' | 'ORDERED' | 'RECEIVED';

interface ReportsPageProps {
    onNavigateToInventory?: () => void;
    onOpenAddItemModal?: () => void;
    onOpenNewRequestModal?: () => void;
    onSetInventoryFilters?: (filters: {
        search: string;
        location: string[];
        item_type: string[];
        vendor: string[];
        expired: string[];
        low_stock: string[];
    }) => void;
}

interface ReportSummary {
    total_items: number;
    total_value: number;
    low_stock_items: number;
    expired_items: number;
    expiring_soon: number;
}

interface BreakdownItem {
    item_type__name: string;
    count: number;
    total_value: number;
}

interface ReportsData {
    summary: ReportSummary;
    breakdown: BreakdownItem[];
}

interface RequestRecord {
    id: number;
    status: string;
    item_name?: string;
    quantity?: number;
    unit_price?: number;
    created_at: string;
    requested_by?: { username?: string };
    vendor?: { name?: string };
}

interface ExpiringItem {
    id: number;
    name: string;
    serial_number?: string;
    vendor?: { name?: string };
    expiration_date?: string;
    days_until_expiration?: number;
    expiration_status?: string;
    quantity?: number;
    specifications?: string;
    location?: string;
    catalog_number?: string;
}

interface ItemRecord {
    created_at?: string;
    item_type?: { name?: string };
    price?: number | string;
}

const DEFAULT_SUMMARY: ReportSummary = {
    total_items: 0,
    total_value: 0,
    low_stock_items: 0,
    expired_items: 0,
    expiring_soon: 0
};

const toArray = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
        return (payload as { results: T[] }).results;
    }
    return [];
};

const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number): string => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const getStatusPresentation = (status: string) => {
    switch (status) {
        case 'NEW':
            return { label: 'Awaiting Review', icon: FileText, badge: 'badge badge-primary', color: 'primary', borderColor: 'border-l-primary-500' };
        case 'APPROVED':
            return { label: 'Approved', icon: CheckCircle2, badge: 'badge badge-success', color: 'success', borderColor: 'border-l-success-500' };
        case 'ORDERED':
            return { label: 'Ordered', icon: Package, badge: 'badge badge-warning', color: 'warning', borderColor: 'border-l-warning-500' };
        case 'RECEIVED':
            return { label: 'Received', icon: CheckCircle2, badge: 'badge badge-success', color: 'success', borderColor: 'border-l-success-500' };
        default:
            return { label: status || 'Unknown', icon: FileText, badge: 'badge badge-secondary', color: 'secondary', borderColor: 'border-l-secondary-400' };
    }
};

const CHART_COLORS = [
    'bg-gradient-to-r from-primary-500 to-primary-600',
    'bg-gradient-to-r from-science-500 to-science-600',
    'bg-gradient-to-r from-success-500 to-success-600',
    'bg-gradient-to-r from-warning-500 to-warning-600',
    'bg-gradient-to-r from-danger-500 to-danger-600',
    'bg-gradient-to-r from-info-500 to-info-600',
    'bg-gradient-to-r from-secondary-500 to-secondary-600',
    'bg-gradient-to-r from-primary-400 to-science-500',
];

const SPEND_COLORS = [
    'from-success-300 to-success-400',
    'from-success-400 to-success-500',
    'from-success-500 to-success-600',
    'from-success-500 to-success-600',
    'from-success-600 to-success-700',
    'from-success-600 to-success-700',
];

const ReportsPage = ({
    onNavigateToInventory,
    onOpenAddItemModal,
    onOpenNewRequestModal,
    onSetInventoryFilters
}: ReportsPageProps) => {
    const { token } = useContext(AuthContext);
    const [reports, setReports] = useState<ReportsData>({ summary: DEFAULT_SUMMARY, breakdown: [] });
    const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
    const [allRequests, setAllRequests] = useState<RequestRecord[]>([]);
    const [allItems, setAllItems] = useState<ItemRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');
    const [showAllActivity, setShowAllActivity] = useState(false);
    const hasLoadedRef = useRef(false);

    const navigateToInventory = useCallback((filter = '') => {
        if (!onNavigateToInventory) return;

        if (filter === '?filter=expired' && onSetInventoryFilters) {
            onSetInventoryFilters({ expired: ['true'], low_stock: [], search: '', item_type: [], vendor: [], location: [] });
        } else if (filter === '?filter=low_stock' && onSetInventoryFilters) {
            onSetInventoryFilters({ expired: [], low_stock: ['true'], search: '', item_type: [], vendor: [], location: [] });
        } else if (onSetInventoryFilters) {
            onSetInventoryFilters({ expired: [], low_stock: [], search: '', item_type: [], vendor: [], location: [] });
        }

        onNavigateToInventory();
    }, [onNavigateToInventory, onSetInventoryFilters]);

    const openAddItemModal = () => onOpenAddItemModal && onOpenAddItemModal();
    const openNewRequestModal = () => onOpenNewRequestModal && onOpenNewRequestModal();

    const openImportModal = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.json';
        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
                alert(`Import functionality for ${file.name} would be implemented here`);
            }
        };
        input.click();
    };

    const recentActivity = useMemo(() => allRequests.slice(0, 12), [allRequests]);

    const statusCounts = useMemo(() => {
        return allRequests.reduce(
            (acc, request) => {
                if (request.status in acc) {
                    acc[request.status as keyof typeof acc] += 1;
                }
                acc.ALL += 1;
                return acc;
            },
            { ALL: 0, NEW: 0, APPROVED: 0, ORDERED: 0, RECEIVED: 0 }
        );
    }, [allRequests]);

    const displayedActivity = useMemo(() => {
        if (activityFilter === 'ALL') return recentActivity;
        return recentActivity.filter((item) => item.status === activityFilter);
    }, [recentActivity, activityFilter]);

    const visibleActivity = useMemo(() => {
        return showAllActivity ? displayedActivity : displayedActivity.slice(0, 6);
    }, [displayedActivity, showAllActivity]);

    const monthlySpending = useMemo(() => {
        const grouped = allRequests.reduce((acc, request) => {
            if (request.status !== 'RECEIVED' && request.status !== 'ORDERED') return acc;

            const createdAt = new Date(request.created_at);
            const monthKey = createdAt.toISOString().slice(0, 7);
            const cost = toNumber(request.unit_price) * toNumber(request.quantity);

            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                    total_spend: 0
                };
            }

            acc[monthKey].total_spend += cost;
            return acc;
        }, {} as Record<string, { month: string; total_spend: number }>);

        return Object.keys(grouped)
            .sort()
            .slice(-6)
            .map((key) => ({ month: grouped[key].month, total_spend: grouped[key].total_spend }));
    }, [allRequests]);

    const filteredItemsByType = useMemo(() => {
        if (!allItems.length) return [] as BreakdownItem[];

        const selectedDate = new Date(`${selectedMonth}-01T00:00:00`);
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthItems = allItems.filter((item) => {
            if (!item.created_at) return false;
            const itemDate = new Date(item.created_at);
            return itemDate >= startOfMonth && itemDate <= endOfMonth;
        });

        const grouped = monthItems.reduce((acc, item) => {
            const typeName = item.item_type?.name || 'Unknown';
            if (!acc[typeName]) {
                acc[typeName] = {
                    item_type__name: typeName,
                    count: 0,
                    total_value: 0
                };
            }
            acc[typeName].count += 1;
            acc[typeName].total_value += toNumber(item.price);
            return acc;
        }, {} as Record<string, BreakdownItem>);

        return Object.values(grouped).sort((a, b) => b.count - a.count);
    }, [allItems, selectedMonth]);

    const actionQueue = useMemo(() => {
        const awaitingApproval = allRequests.filter((req) => req.status === 'NEW').length;
        const orderedPendingReceipt = allRequests.filter((req) => req.status === 'ORDERED').length;

        return [
            {
                id: 'expired',
                title: 'Expired items need archive or disposal',
                value: reports.summary.expired_items,
                tone: 'danger' as const,
                icon: ShieldAlert,
                cta: 'Review expired items',
                onClick: () => navigateToInventory('?filter=expired')
            },
            {
                id: 'low-stock',
                title: 'Low stock items need restock planning',
                value: reports.summary.low_stock_items,
                tone: 'warning' as const,
                icon: PackageOpen,
                cta: 'Open low stock list',
                onClick: () => navigateToInventory('?filter=low_stock')
            },
            {
                id: 'new-requests',
                title: 'New requests are waiting for approval',
                value: awaitingApproval,
                tone: 'primary' as const,
                icon: FileText,
                cta: 'Review in activity stream'
            },
            {
                id: 'ordered',
                title: 'Orders placed and waiting to be received',
                value: orderedPendingReceipt,
                tone: 'secondary' as const,
                icon: Package,
                cta: 'Track in activity stream'
            }
        ];
    }, [allRequests, reports.summary.expired_items, reports.summary.low_stock_items, navigateToInventory]);

    const fetchJson = async (url: string, headers: HeadersInit) => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Request failed (${response.status}): ${url}`);
        }
        return response.json();
    };

    const fetchDashboardData = useCallback(async () => {
        if (!token) return;

        setRefreshing(true);
        if (!hasLoadedRef.current) setLoading(true);

        try {
            const headers = { Authorization: `Token ${token}` };
            const [reportsPayload, expiringPayload, requestsPayload, itemsPayload] = await Promise.all([
                fetchJson(buildApiUrl(API_ENDPOINTS.ITEMS_REPORTS), headers),
                fetchJson(buildApiUrl(API_ENDPOINTS.ITEMS_EXPIRING), headers),
                fetchJson(`${buildApiUrl(API_ENDPOINTS.REQUESTS)}?ordering=-created_at&limit=1000`, headers),
                fetchJson(`${buildApiUrl(API_ENDPOINTS.ITEMS)}?limit=10000`, headers)
            ]);

            const reportsData = reportsPayload as any;
            const breakdownSource = Array.isArray(reportsData?.breakdown)
                ? reportsData.breakdown
                : Array.isArray(reportsData?.breakdown?.by_type)
                    ? reportsData.breakdown.by_type
                    : [];

            const normalizedBreakdown = breakdownSource.map((item: Partial<BreakdownItem>) => ({
                item_type__name: item.item_type__name || 'Unknown',
                count: toNumber(item.count),
                total_value: toNumber(item.total_value)
            }));

            setReports({
                summary: {
                    ...DEFAULT_SUMMARY,
                    ...(reportsData?.summary || {})
                },
                breakdown: normalizedBreakdown
            });
            setExpiringItems(toArray<ExpiringItem>((expiringPayload as any)?.items || expiringPayload));
            setAllRequests(toArray<RequestRecord>(requestsPayload));
            setAllItems(toArray<ItemRecord>(itemsPayload));
            setError(null);
        } catch (err) {
            console.error('Error fetching reports:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            hasLoadedRef.current = true;
        }
    }, [token]);

    const exportReport = () => {
        const now = new Date();

        const summaryData = Object.entries(reports.summary || {}).map(([key, value]) => ({
            'Statistic Item':
                key === 'total_items'
                    ? 'Total Items'
                    : key === 'total_value'
                        ? 'Total Value'
                        : key === 'low_stock_items'
                            ? 'Low Stock Items'
                            : key === 'expired_items'
                                ? 'Expired Items'
                                : key === 'expiring_soon'
                                    ? 'Expiring Soon Items'
                                    : key,
            Value: typeof value === 'number' && key.includes('value') ? `$${value.toFixed(2)}` : value
        }));

        const breakdownData = reports.breakdown.map((item) => ({
            'Item Type': item.item_type__name || 'Uncategorized',
            Count: item.count,
            'Total Value': `$${(item.total_value || 0).toFixed(2)}`,
            Percentage: `${((item.count / (reports.summary?.total_items || 1)) * 100).toFixed(1)}%`
        }));

        const expiringData = expiringItems.map((item) => ({
            'Item Name': item.name,
            Specifications: item.specifications || '',
            Quantity: item.quantity,
            Location: item.location || '',
            'Expiration Date': item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('en-US') : '',
            'Days Remaining': item.expiration_date ? Math.ceil((new Date(item.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : '',
            Vendor: item.vendor?.name || '',
            'Catalog Number': item.catalog_number || ''
        }));

        const spendingData = monthlySpending.map((item) => ({
            Month: item.month,
            'Amount Spent': `$${item.total_spend.toFixed(2)}`
        }));

        const monthlyTypeData = filteredItemsByType.map((item) => ({
            'Item Type': item.item_type__name,
            'New Count': item.count,
            'New Value': `$${item.total_value.toFixed(2)}`
        }));

        const summary = {
            'Report Generated': now.toLocaleString('en-US'),
            'Report Month': new Date(`${selectedMonth}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
            'Total Items': reports.summary.total_items,
            'Total Inventory Value': `$${reports.summary.total_value.toFixed(2)}`,
            'Low Stock Items': reports.summary.low_stock_items,
            'Expired Items': reports.summary.expired_items,
            'Expiring Soon Items': expiringItems.length,
            'Current Month Spending': monthlySpending.length ? `$${monthlySpending[monthlySpending.length - 1].total_spend.toFixed(2)}` : '$0.00'
        };

        exportMultiSheetExcel({
            fileName: 'inventory-report',
            summary,
            sheets: [
                { name: 'Overall Statistics', title: 'Inventory Overall Statistics', data: summaryData },
                { name: 'Category Breakdown', title: 'Statistics by Item Type', data: breakdownData },
                { name: 'Expiring Items', title: 'Items Expiring Soon', data: expiringData },
                { name: 'Monthly Spending', title: 'Recent Monthly Spending Statistics', data: spendingData },
                {
                    name: 'Monthly New Items',
                    title: `${new Date(`${selectedMonth}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} New Items Statistics`,
                    data: monthlyTypeData
                }
            ]
        });
    };

    useEffect(() => {
        if (token) {
            hasLoadedRef.current = false;
            fetchDashboardData();
            const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [token, fetchDashboardData]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
                    <Beaker className="w-5 h-5 text-primary-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-secondary-500 font-medium">Loading dashboard data...</p>
            </div>
        );
    }

    const latestMonthlySpend = monthlySpending.length ? monthlySpending[monthlySpending.length - 1].total_spend : 0;
    const maxMonthlySpend = monthlySpending.length ? Math.max(...monthlySpending.map((item) => item.total_spend)) : 0;
    const inventoryMix = filteredItemsByType.length ? filteredItemsByType : reports.breakdown;
    const activityFilters: ActivityFilter[] = ['ALL', 'NEW', 'APPROVED', 'ORDERED', 'RECEIVED'];

    return (
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto">
            {/* ═══════════════════════════════════════════════════════════════
                HERO HEADER with gradient background + embedded KPIs
               ═══════════════════════════════════════════════════════════════ */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 via-science-50 to-white p-6 lg:p-8 shadow-lg border border-primary-100 mb-8 animate-fade-in">
                {/* Decorative background elements */}
                <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary-200/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-science-200/25 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-full h-full opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                <div className="relative z-10">
                    {/* Title + Actions Row */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-primary-100 rounded-xl shadow-sm">
                                    <Beaker className="w-6 h-6 text-primary-600" />
                                </div>
                                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-secondary-900">Laboratory Dashboard</h1>
                            </div>
                            <p className="text-secondary-500 text-sm">
                                Operations overview · Last sync {currentTime.toLocaleTimeString()} · Auto-refresh every 5 min
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={exportReport}
                                className="flex items-center px-4 py-2.5 bg-white text-secondary-700 rounded-xl border border-secondary-200 hover:bg-secondary-50 hover:border-secondary-300 shadow-sm transition-all duration-300 text-sm font-medium"
                            >
                                <Download className="w-4 h-4 mr-2 text-secondary-500" />
                                Export
                            </button>
                            <button
                                onClick={fetchDashboardData}
                                className="flex items-center px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-md shadow-primary-500/20 transition-all duration-300 text-sm font-semibold"
                                disabled={refreshing}
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                        {[
                            {
                                label: 'Total Items',
                                value: reports.summary.total_items,
                                icon: Package,
                                format: (v: number) => v.toLocaleString()
                            },
                            {
                                label: 'Inventory Value',
                                value: reports.summary.total_value,
                                icon: DollarSign,
                                format: (v: number) => formatCurrency(v)
                            },
                            {
                                label: 'Low Stock',
                                value: reports.summary.low_stock_items,
                                icon: AlertTriangle,
                                format: (v: number) => v.toString(),
                                alert: reports.summary.low_stock_items > 0
                            },
                            {
                                label: 'Expired',
                                value: reports.summary.expired_items,
                                icon: Clock,
                                format: (v: number) => v.toString(),
                                alert: reports.summary.expired_items > 0
                            }
                        ].map((kpi, idx) => {
                            const KpiIcon = kpi.icon;
                            return (
                                <div
                                    key={kpi.label}
                                    className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-primary-100 hover:shadow-md hover:border-primary-200 transition-all duration-300 group"
                                    style={{ animationDelay: `${idx * 0.1}s` }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold tracking-wide text-secondary-500 uppercase">{kpi.label}</span>
                                        <KpiIcon className={`w-4 h-4 ${kpi.alert ? 'text-warning-500 animate-pulse' : 'text-secondary-400'} group-hover:scale-110 transition-transform`} />
                                    </div>
                                    <p className="text-2xl lg:text-3xl font-bold tracking-tight text-secondary-900">{kpi.format(kpi.value)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-danger-200 bg-danger-50 p-4 text-danger-700 text-sm flex items-center gap-3 animate-slide-up">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ROW 1: Recent Activity + Quick Actions
               ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
                {/* Recent Activity */}
                <section className="xl:col-span-8 bg-white rounded-2xl border border-secondary-200 shadow-soft p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-primary-100 rounded-lg">
                                    <Activity className="w-4 h-4 text-primary-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-secondary-900">Recent Activity</h2>
                            </div>
                            <p className="text-sm text-secondary-500 mt-1">
                                Latest request flow with operational context
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {activityFilters.map((filterKey) => (
                                <button
                                    key={filterKey}
                                    onClick={() => setActivityFilter(filterKey)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${activityFilter === filterKey
                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/25'
                                        : 'bg-secondary-100 text-secondary-600 border border-secondary-200 hover:bg-secondary-200'
                                        }`}
                                >
                                    {filterKey === 'ALL' ? 'All' : filterKey} ({statusCounts[filterKey]})
                                </button>
                            ))}
                            {displayedActivity.length > 6 && (
                                <button
                                    onClick={() => setShowAllActivity((prev) => !prev)}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all duration-200"
                                >
                                    {showAllActivity ? 'Show less' : 'Show all'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={`space-y-2.5 ${showAllActivity ? 'max-h-[700px]' : 'max-h-[470px]'} overflow-y-auto pr-1 scrollbar-thin`}>
                        {visibleActivity.length > 0 ? (
                            visibleActivity.map((activity, idx) => {
                                const statusMeta = getStatusPresentation(activity.status);
                                const StatusIcon = statusMeta.icon;
                                return (
                                    <div
                                        key={activity.id}
                                        className={`rounded-xl border border-secondary-200 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border-l-4 ${statusMeta.borderColor} animate-fade-in`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-1.5">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-secondary-900 truncate">{activity.item_name || 'Request item'}</p>
                                                <p className="text-xs text-secondary-500">
                                                    {activity.requested_by?.username || 'Unknown user'} · {new Date(activity.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={statusMeta.badge}>
                                                <StatusIcon className="w-3 h-3 mr-1" />
                                                {statusMeta.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondary-600">
                                            Qty {toNumber(activity.quantity)} · Unit ${toNumber(activity.unit_price).toFixed(2)} · Vendor {activity.vendor?.name || 'N/A'}
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-10 text-center text-secondary-500">
                                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary-100 flex items-center justify-center">
                                    <Activity className="w-7 h-7 text-secondary-400" />
                                </div>
                                <p className="font-medium">No activity in this filter</p>
                                <p className="text-xs mt-1">Try selecting a different status filter</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Right Side: Quick Actions */}
                <aside className="xl:col-span-4 space-y-6">
                    <section className="bg-white rounded-2xl border border-secondary-200 shadow-soft p-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
                        <div className="flex items-center gap-2 mb-5">
                            <div className="p-1.5 bg-success-100 rounded-lg">
                                <Sparkles className="w-4 h-4 text-success-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-secondary-900">Quick Actions</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                {
                                    label: 'Add New Item',
                                    desc: 'Register new inventory',
                                    icon: PlusCircle,
                                    onClick: openAddItemModal,
                                    bgClass: 'bg-primary-50 hover:bg-primary-100 border border-primary-200 hover:border-primary-300',
                                    iconBg: 'bg-primary-100',
                                    iconColor: 'text-primary-600',
                                },
                                {
                                    label: 'New Request',
                                    desc: 'Submit an order request',
                                    icon: FileText,
                                    onClick: openNewRequestModal,
                                    bgClass: 'bg-science-50 hover:bg-science-100 border border-science-200 hover:border-science-300',
                                    iconBg: 'bg-science-100',
                                    iconColor: 'text-science-600',
                                },
                                {
                                    label: 'Import Data',
                                    desc: 'CSV, Excel, or JSON',
                                    icon: Upload,
                                    onClick: openImportModal,
                                    bgClass: 'bg-secondary-50 hover:bg-secondary-100 border border-secondary-200 hover:border-secondary-300',
                                    iconBg: 'bg-secondary-100',
                                    iconColor: 'text-secondary-600',
                                }
                            ].map((action, idx) => {
                                const ActionIcon = action.icon;
                                return (
                                    <button
                                        key={action.label}
                                        onClick={action.onClick}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] text-left ${action.bgClass}`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <div className={`p-2.5 rounded-xl ${action.iconBg} flex-shrink-0`}>
                                            <ActionIcon className={`w-5 h-5 ${action.iconColor}`} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-secondary-800">{action.label}</p>
                                            <p className="text-xs text-secondary-500">{action.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </aside>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                ROW 2: Action Queue + Spend Trend
               ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
                {/* Action Queue */}
                <section className="xl:col-span-5 bg-white rounded-2xl border border-secondary-200 shadow-soft p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-warning-100 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-warning-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-secondary-900">Action Queue</h2>
                        </div>
                        <p className="text-sm text-secondary-500 mt-1">Priority tasks requiring decisions</p>
                    </div>
                    <div className="space-y-3">
                        {actionQueue.map((action, idx) => {
                            const ActionIcon = action.icon;
                            const toneClasses = {
                                danger: { border: 'border-danger-200', bg: 'bg-danger-50', iconBg: 'bg-danger-100', iconColor: 'text-danger-600', hoverBg: 'hover:bg-danger-100', valueBg: 'bg-danger-100 text-danger-700' },
                                warning: { border: 'border-warning-200', bg: 'bg-warning-50', iconBg: 'bg-warning-100', iconColor: 'text-warning-600', hoverBg: 'hover:bg-warning-100', valueBg: 'bg-warning-100 text-warning-700' },
                                primary: { border: 'border-primary-200', bg: 'bg-primary-50', iconBg: 'bg-primary-100', iconColor: 'text-primary-600', hoverBg: 'hover:bg-primary-100', valueBg: 'bg-primary-100 text-primary-700' },
                                secondary: { border: 'border-secondary-200', bg: 'bg-secondary-50', iconBg: 'bg-secondary-100', iconColor: 'text-secondary-600', hoverBg: 'hover:bg-secondary-100', valueBg: 'bg-secondary-200 text-secondary-700' }
                            };
                            const t = toneClasses[action.tone] || toneClasses.secondary;

                            return (
                                <div
                                    key={action.id}
                                    className={`rounded-xl border ${t.border} ${t.bg} ${t.hoverBg} p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${t.iconBg} flex-shrink-0`}>
                                            <ActionIcon className={`w-4 h-4 ${t.iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-secondary-900">{action.title}</p>
                                            {action.onClick && (
                                                <button onClick={action.onClick} className="mt-1 inline-flex items-center text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors">
                                                    {action.cta}
                                                    <ArrowRight className="w-3 h-3 ml-1" />
                                                </button>
                                            )}
                                        </div>
                                        <span className={`text-xl font-bold px-3 py-1 rounded-xl ${t.valueBg}`}>{action.value}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Spend Trend */}
                <section className="xl:col-span-7 bg-white rounded-2xl border border-secondary-200 shadow-soft p-6 animate-fade-in" style={{ animationDelay: '0.25s' }}>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-success-100 rounded-lg">
                                    <TrendingUp className="w-4 h-4 text-success-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-secondary-900">Spend Trend</h2>
                            </div>
                            <p className="text-sm text-secondary-500 mt-1">Last 6 months of ordered/received spending</p>
                        </div>
                    </div>

                    {monthlySpending.length > 0 ? (
                        <>
                            <div className="space-y-4">
                                {monthlySpending.map((item, idx) => {
                                    const percentage = maxMonthlySpend > 0 ? (item.total_spend / maxMonthlySpend) * 100 : 0;
                                    const colorGradient = SPEND_COLORS[idx] || SPEND_COLORS[SPEND_COLORS.length - 1];
                                    return (
                                        <div key={item.month} className="group">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-sm font-medium text-secondary-700">{item.month}</span>
                                                <span className="text-sm font-bold text-secondary-900 tabular-nums">{formatCurrency(item.total_spend)}</span>
                                            </div>
                                            <div className="h-3 rounded-full bg-secondary-100 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${colorGradient} transition-all duration-700 ease-out group-hover:shadow-md`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-5 pt-4 border-t border-secondary-200 flex items-center justify-between">
                                <span className="text-sm text-secondary-600">6-month total</span>
                                <span className="text-xl font-bold bg-gradient-to-r from-success-600 to-success-700 bg-clip-text text-transparent">
                                    {formatCurrency(monthlySpending.reduce((sum, item) => sum + item.total_spend, 0))}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="py-10 text-center text-secondary-500">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary-100 flex items-center justify-center">
                                <TrendingUp className="w-7 h-7 text-secondary-400" />
                            </div>
                            <p className="font-medium">No spending data available</p>
                            <p className="text-xs mt-1">Data will appear once orders are placed</p>
                        </div>
                    )}
                </section>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                ROW 3: Inventory Mix + Expiring Focus List
               ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Inventory Mix */}
                <section className="xl:col-span-6 bg-white rounded-2xl border border-secondary-200 shadow-soft p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-primary-100 rounded-lg">
                                    <Package className="w-4 h-4 text-primary-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-secondary-900">Inventory Mix</h2>
                            </div>
                            <p className="text-sm text-secondary-500 mt-1">Distribution by item type</p>
                        </div>
                        <select
                            className="text-xs border border-secondary-200 rounded-lg px-3 py-2 bg-secondary-50 hover:bg-secondary-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            value={selectedMonth}
                            onChange={(event) => setSelectedMonth(event.target.value)}
                        >
                            {Array.from({ length: 12 }, (_, index) => {
                                const date = new Date();
                                date.setMonth(date.getMonth() - index);
                                const value = date.toISOString().slice(0, 7);
                                const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                                return (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {inventoryMix.length > 0 ? (
                        <div className="space-y-4">
                            {inventoryMix.slice(0, 8).map((item, idx) => {
                                const maxCount = Math.max(...inventoryMix.map((entry) => entry.count), 1);
                                const percentage = (item.count / maxCount) * 100;
                                const barColor = CHART_COLORS[idx % CHART_COLORS.length];

                                return (
                                    <div key={item.item_type__name} className="group">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 rounded-full ${barColor}`} />
                                                <span className="text-sm font-medium text-secondary-700">{item.item_type__name}</span>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                <span className="text-xs text-secondary-500">{formatCurrency(item.total_value)}</span>
                                                <span className="text-sm font-bold text-secondary-900 tabular-nums w-8 text-right">{item.count}</span>
                                            </div>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-secondary-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-secondary-500">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary-100 flex items-center justify-center">
                                <Package className="w-7 h-7 text-secondary-400" />
                            </div>
                            <p className="font-medium">No data for selected month</p>
                            <p className="text-xs mt-1">Try selecting a different time period</p>
                        </div>
                    )}
                </section>

                {/* Expiring Focus List */}
                <section className="xl:col-span-6 bg-white rounded-2xl border border-secondary-200 shadow-soft overflow-hidden animate-fade-in" style={{ animationDelay: '0.35s' }}>
                    <div className="p-6 border-b border-secondary-200 flex items-center justify-between bg-gradient-to-r from-secondary-50 to-white">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-warning-100 rounded-lg">
                                    <Clock className="w-4 h-4 text-warning-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-secondary-900">Expiring Focus List</h2>
                            </div>
                            <p className="text-sm text-secondary-500 mt-1">Highest-priority expiring inventory</p>
                        </div>
                        <span className="badge badge-warning font-bold">{expiringItems.length} items</span>
                    </div>

                    {expiringItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-secondary-800">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Item</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Vendor</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Expiration</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Days Left</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100">
                                    {expiringItems.slice(0, 8).map((item, idx) => {
                                        const daysLeft = toNumber(item.days_until_expiration);
                                        const urgencyClass = daysLeft <= 3
                                            ? 'text-danger-700 bg-danger-50'
                                            : daysLeft <= 7
                                                ? 'text-danger-600 bg-danger-50/50'
                                                : daysLeft <= 14
                                                    ? 'text-warning-600 bg-warning-50'
                                                    : 'text-warning-600';

                                        return (
                                            <tr key={item.id} className="hover:bg-secondary-50 transition-colors duration-150">
                                                <td className="px-6 py-3.5">
                                                    <div className="font-medium text-sm text-secondary-900">{item.name}</div>
                                                    <div className="text-xs text-secondary-500">#{item.serial_number || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-3.5 text-sm text-secondary-600">{item.vendor?.name || 'N/A'}</td>
                                                <td className="px-6 py-3.5 text-sm text-secondary-600">
                                                    {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${urgencyClass}`}>
                                                        {daysLeft} days
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="p-4 border-t border-secondary-200 bg-secondary-50/50">
                                <button
                                    onClick={() => navigateToInventory('?filter=expired')}
                                    className="inline-flex items-center text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors group"
                                >
                                    Open full expiring inventory view
                                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-secondary-500">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-success-100 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-success-500" />
                            </div>
                            <p className="font-medium text-secondary-700">All clear!</p>
                            <p className="text-xs mt-1">No expiring inventory requires attention</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
};

export default ReportsPage;
