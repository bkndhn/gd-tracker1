import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageDisplay } from '@/components/ImageDisplay';
import { ImageThumbnail } from '@/components/ImageThumbnail';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { NoteViewerModal } from '@/components/NoteViewerModal';
import { toast } from 'sonner';
import { Download, Filter, Calendar as CalendarIcon, FileText, Image, BarChart3, List, LayoutGrid, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Volume2, Trash2, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { Database } from '@/types/database';
import * as XLSX from 'xlsx';
import { exportToPDFViaHTML, exportMultiSectionPDFViaHTML, makeImageCell, type CellContent } from '@/utils/htmlPdfExport';

interface CustomFieldDef {
  id: string;
  name: string;
  is_visible: boolean;
  display_order: number;
}

type GoodsEntry = Database['public']['Tables']['goods_damaged_entries']['Row'] & {
  categories: { name: string };
  sizes: { size: string };
  shops: { name: string };
  customer_types?: { name: string };
  gd_entry_images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
  voice_note_url?: string | null;
  customFieldValues?: Record<string, string>; // fieldId -> option value text
};

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type CustomerType = Database['public']['Tables']['customer_types']['Row'];

export const ReportsPanel = () => {
  const { profile, isAdmin, isManager, userShopId } = useAuth();
  const { isOnline, pendingCount } = useOfflineSync();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<GoodsEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<GoodsEntry[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  // Filter states - default to "today"
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [reporterSearch, setReporterSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Table column filters (Excel-like)
  const [tableShopFilters, setTableShopFilters] = useState<string[]>([]);
  const [tableCategoryFilters, setTableCategoryFilters] = useState<string[]>([]);
  const [tableSizeFilters, setTableSizeFilters] = useState<string[]>([]);
  const [tableCustomerTypeFilters, setTableCustomerTypeFilters] = useState<string[]>([]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk delete state (admin only)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-fetch data when Manager's shop ID becomes available
  useEffect(() => {
    fetchData();
  }, [isManager, userShopId]);

  useEffect(() => {
    applyFilters();
  }, [entries, selectedShop, selectedCategory, selectedSize, selectedCustomerType, dateFilter, customDateFrom, customDateTo, reporterSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (import.meta.env.DEV) console.log('Starting to fetch data...', { isManager, userShopId });

      // Fetch entries with images
      let query = supabase
        .from('goods_damaged_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (isManager && userShopId) {
        if (import.meta.env.DEV) console.log('Filtering by manager shop:', userShopId);
        query = query.eq('shop_id', userShopId);
      }

      const { data: entriesData, error: entriesError } = await query;

      if (entriesError) {
        if (import.meta.env.DEV) console.error('Error fetching entries:', entriesError);
        throw entriesError;
      }

      if (import.meta.env.DEV) console.log('Fetched entries:', entriesData);

      // Get entry IDs to filter images
      const entryIds = entriesData.map(e => e.id);

      // Fetch images only for the entries we have access to
      let imagesData: any[] = [];
      if (entryIds.length > 0) {
        const { data: imgData, error: imagesError } = await supabase
          .from('gd_entry_images')
          .select('*')
          .in('gd_entry_id', entryIds)
          .order('created_at', { ascending: true });

        if (imagesError) {
          if (import.meta.env.DEV) console.error('Error fetching images:', imagesError);
          // Don't throw - just log and continue with empty images
        } else {
          imagesData = imgData || [];
        }
      }

      if (import.meta.env.DEV) console.log('Fetched images for entries:', imagesData);


      // Fetch related data separately (including custom fields)
      const [shopsRes, categoriesRes, sizesRes, customerTypesRes, cfRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
        (supabase.from('custom_fields') as any).select('*').is('deleted_at', null).eq('is_visible', true).order('display_order'),
      ]);

      if (shopsRes.error) {
        if (import.meta.env.DEV) console.error('Error fetching shops:', shopsRes.error);
        throw shopsRes.error;
      }
      if (categoriesRes.error) {
        if (import.meta.env.DEV) console.error('Error fetching categories:', categoriesRes.error);
        throw categoriesRes.error;
      }
      if (sizesRes.error) {
        if (import.meta.env.DEV) console.error('Error fetching sizes:', sizesRes.error);
        throw sizesRes.error;
      }
      if (customerTypesRes.error) {
        if (import.meta.env.DEV) console.error('Error fetching customer types:', customerTypesRes.error);
        throw customerTypesRes.error;
      }

      // Fetch custom field values and options for entries
      const visibleFields: CustomFieldDef[] = cfRes.data || [];
      let customValuesMap: Record<string, Record<string, string>> = {}; // entryId -> { fieldId -> optionValue }

      if (visibleFields.length > 0 && entryIds.length > 0) {
        const fieldIds = visibleFields.map(f => f.id);
        const [cvRes, cfoRes] = await Promise.all([
          (supabase.from('gd_entry_custom_values') as any)
            .select('*')
            .in('gd_entry_id', entryIds)
            .in('custom_field_id', fieldIds),
          (supabase.from('custom_field_options') as any)
            .select('*')
            .in('custom_field_id', fieldIds)
            .is('deleted_at', null),
        ]);

        const optionsById: Record<string, string> = {};
        (cfoRes.data || []).forEach((opt: any) => { optionsById[opt.id] = opt.value; });

        (cvRes.data || []).forEach((cv: any) => {
          if (!customValuesMap[cv.gd_entry_id]) customValuesMap[cv.gd_entry_id] = {};
          customValuesMap[cv.gd_entry_id][cv.custom_field_id] = optionsById[cv.custom_field_option_id] || 'N/A';
        });
      }

      // Manually join the data including images
      const enrichedEntries = entriesData.map(entry => {
        const shop = shopsRes.data.find(s => s.id === entry.shop_id);
        const category = categoriesRes.data.find(c => c.id === entry.category_id);
        const size = sizesRes.data.find(s => s.id === entry.size_id);
        const customerType = customerTypesRes.data.find(ct => ct.id === entry.customer_type_id);
        const entryImages = imagesData.filter(img => img.gd_entry_id === entry.id);

        return {
          ...entry,
          shops: { name: shop?.name || 'Unknown Shop' },
          categories: { name: category?.name || 'Unknown Category' },
          sizes: { size: size?.size || 'Unknown Size' },
          customer_types: customerType ? { name: customerType.name } : undefined,
          gd_entry_images: entryImages,
          customFieldValues: customValuesMap[entry.id] || {},
        };
      });

      if (import.meta.env.DEV) console.log('Enriched entries with images:', enrichedEntries);

      setEntries(enrichedEntries);
      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setCustomerTypes(customerTypesRes.data);
      setCustomFields(visibleFields);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching data:', error);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Shop filter
    if (selectedShop !== 'all') {
      filtered = filtered.filter(entry => entry.shop_id === selectedShop);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(entry => entry.category_id === selectedCategory);
    }

    // Size filter
    if (selectedSize !== 'all') {
      filtered = filtered.filter(entry => entry.size_id === selectedSize);
    }

    // Customer type filter
    if (selectedCustomerType !== 'all') {
      filtered = filtered.filter(entry => entry.customer_type_id === selectedCustomerType);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= today;
          });
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= yesterday && entryDate < today;
          });
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= monthAgo;
          });
          break;
        case 'year':
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate >= yearAgo;
          });
          break;
        case 'custom':
          if (customDateFrom && customDateTo) {
            filtered = filtered.filter(entry => {
              const entryDate = new Date(entry.created_at);
              return entryDate >= customDateFrom && entryDate <= customDateTo;
            });
          }
          break;
      }
    }

    // Reporter search (case-insensitive substring match on employee_name)
    if (reporterSearch.trim()) {
      const q = reporterSearch.trim().toLowerCase();
      filtered = filtered.filter(entry => (entry.employee_name || '').toLowerCase().includes(q));
    }

    setFilteredEntries(filtered);
  };

  // Compute summary statistics
  const summary = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) {
      return null;
    }

    const byShop: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySize: Record<string, number> = {};
    const byCustomerType: Record<string, number> = {};
    const byNotes: Record<string, number> = {};
    let firstDate = filteredEntries[0].created_at;
    let lastDate = filteredEntries[0].created_at;

    filteredEntries.forEach((report) => {
      // Count by shop
      const shopName = report.shops?.name || 'Unknown';
      byShop[shopName] = (byShop[shopName] || 0) + 1;

      // Count by category
      const categoryName = report.categories?.name || 'Unknown';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;

      // Count by size
      const sizeName = report.sizes?.size || 'Unknown';
      bySize[sizeName] = (bySize[sizeName] || 0) + 1;

      // Count by customer type
      const customerType = report.customer_types?.name || 'Unknown';
      byCustomerType[customerType] = (byCustomerType[customerType] || 0) + 1;

      // Count by notes (first 50 characters as grouping key)
      const noteKey = report.notes ? report.notes.substring(0, 50).trim() : 'No notes';
      byNotes[noteKey] = (byNotes[noteKey] || 0) + 1;

      // Track date range
      if (report.created_at < firstDate) firstDate = report.created_at;
      if (report.created_at > lastDate) lastDate = report.created_at;
    });

    return {
      totalEntries: filteredEntries.length,
      byShop,
      byCategory,
      bySize,
      byCustomerType,
      byNotes,
      firstDate: new Date(firstDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      lastDate: new Date(lastDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    };
  }, [filteredEntries]);

  // Apply table column filters and sorting for table view
  const tableFilteredEntries = useMemo(() => {
    let result = filteredEntries;

    if (tableShopFilters.length > 0) {
      result = result.filter(e => tableShopFilters.includes(e.shops.name));
    }
    if (tableCategoryFilters.length > 0) {
      result = result.filter(e => tableCategoryFilters.includes(e.categories.name));
    }
    if (tableSizeFilters.length > 0) {
      result = result.filter(e => tableSizeFilters.includes(e.sizes.size));
    }
    if (tableCustomerTypeFilters.length > 0) {
      result = result.filter(e => tableCustomerTypeFilters.includes(e.customer_types?.name || 'N/A'));
    }

    // Apply sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aVal: string = '';
        let bVal: string = '';

        switch (sortColumn) {
          case 'shop':
            aVal = a.shops.name;
            bVal = b.shops.name;
            break;
          case 'category':
            aVal = a.categories.name;
            bVal = b.categories.name;
            break;
          case 'size':
            aVal = a.sizes.size;
            bVal = b.sizes.size;
            break;
          case 'customerType':
            aVal = a.customer_types?.name || 'N/A';
            bVal = b.customer_types?.name || 'N/A';
            break;
          case 'notes':
            aVal = a.notes || '';
            bVal = b.notes || '';
            break;
          case 'date':
            aVal = a.created_at || '';
            bVal = b.created_at || '';
            break;
        }

        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [filteredEntries, tableShopFilters, tableCategoryFilters, tableSizeFilters, tableCustomerTypeFilters, sortColumn, sortDirection]);

  // Paginated entries
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return tableFilteredEntries.slice(startIndex, startIndex + pageSize);
  }, [tableFilteredEntries, currentPage, pageSize]);

  const totalPages = useMemo(() => Math.ceil(tableFilteredEntries.length / pageSize), [tableFilteredEntries.length, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tableShopFilters, tableCategoryFilters, tableSizeFilters, tableCustomerTypeFilters, filteredEntries]);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Get unique values for column filters
  const uniqueShopNames = useMemo(() => [...new Set(filteredEntries.map(e => e.shops.name))].sort(), [filteredEntries]);
  const uniqueCategoryNames = useMemo(() => [...new Set(filteredEntries.map(e => e.categories.name))].sort(), [filteredEntries]);
  const uniqueSizeNames = useMemo(() => [...new Set(filteredEntries.map(e => e.sizes.size))].sort(), [filteredEntries]);
  const uniqueCustomerTypeNames = useMemo(() => [...new Set(filteredEntries.map(e => e.customer_types?.name || 'N/A'))].sort(), [filteredEntries]);

  // Toggle filter value
  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (filters.includes(value)) {
      setFilters(filters.filter(f => f !== value));
    } else {
      setFilters([...filters, value]);
    }
  };

  // Select all / Clear all for a filter
  const selectAllFilter = (values: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters([...values]);
  };

  const clearFilter = (setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters([]);
  };

  // Column filter dropdown component - entire header clickable
  const ColumnFilterDropdown = ({
    title,
    values,
    selectedFilters,
    setFilters,
    sortKey,
    showSort = true
  }: {
    title: string;
    values: string[];
    selectedFilters: string[];
    setFilters: React.Dispatch<React.SetStateAction<string[]>>;
    sortKey?: string;
    showSort?: boolean;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center cursor-pointer hover:text-primary/80 transition-colors select-none">
          <span>{title}</span>
          <ChevronDown className={`h-3 w-3 ml-1 ${selectedFilters.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          {showSort && sortKey && (
            <span onClick={(e) => { e.stopPropagation(); handleSort(sortKey); }}>
              {getSortIcon(sortKey)}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-2">
          <div className="flex gap-1 border-b pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => selectAllFilter(values, setFilters)}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => clearFilter(setFilters)}
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-1">
              {values.map((value) => (
                <div
                  key={value}
                  className="flex items-center gap-2 px-1 py-1 hover:bg-muted rounded cursor-pointer"
                  onClick={() => toggleFilter(value, selectedFilters, setFilters)}
                >
                  <Checkbox
                    checked={selectedFilters.includes(value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs truncate">{value}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Bulk delete functions (admin only)
  const toggleSelectEntry = (entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === paginatedEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(paginatedEntries.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    
    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedEntries);
      
      // Delete associated images from storage first
      for (const id of idsToDelete) {
        const entry = entries.find(e => e.id === id);
        if (entry?.gd_entry_images?.length) {
          for (const img of entry.gd_entry_images) {
            const path = img.image_url.split('/gd-entry-images/')[1];
            if (path) {
              await supabase.storage.from('gd-entry-images').remove([path]);
            }
          }
        }
        if (entry?.voice_note_url) {
          const voicePath = entry.voice_note_url.split('/gd-voice-notes/')[1];
          if (voicePath) {
            await supabase.storage.from('gd-voice-notes').remove([voicePath]);
          }
        }
      }

      // Delete image records
      await supabase.from('gd_entry_images').delete().in('gd_entry_id', idsToDelete);

      // Delete entries
      const { error } = await supabase.from('goods_damaged_entries').delete().in('id', idsToDelete);
      
      if (error) throw error;

      toast.success(`Deleted ${idsToDelete.length} entries`);
      setSelectedEntries(new Set());
      fetchData();
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Bulk delete error:', error);
      toast.error(error.message || 'Failed to delete entries');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export table data to Excel
  const exportTableExcel = () => {
    if (tableFilteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = tableFilteredEntries.map((entry, index) => {
      const base: Record<string, any> = {
        'S.NO': index + 1,
        'SHOP': entry.shops.name,
        'CATEGORY': entry.categories.name,
        'SIZE': entry.sizes.size,
        'CUSTOMER TYPE': entry.customer_types?.name || 'N/A',
      };
      customFields.forEach(cf => {
        base[cf.name.toUpperCase()] = entry.customFieldValues?.[cf.id] || 'N/A';
      });
      base['NOTES'] = entry.notes || '';
      base['DATE AND TIME'] = formatDateTime(entry.created_at!);
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Auto-fit columns
    const colWidths = [
      { wch: 6 },  // S.NO
      { wch: 15 }, // SHOP
      { wch: 15 }, // CATEGORY
      { wch: 10 }, // SIZE
      { wch: 18 }, // CUSTOMER TYPE
      ...customFields.map(() => ({ wch: 15 })),
      { wch: 40 }, // NOTES
      { wch: 20 }, // DATE AND TIME
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GD Reports');

    const fileName = `gd-reports-table-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel exported successfully');
  };

  // Export table data to PDF using HTML print method (supports Tamil + images)
  const exportTablePDF = () => {
    if (tableFilteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const rows: CellContent[][] = tableFilteredEntries.map((entry, index) => [
      String(index + 1),
      entry.shops.name,
      entry.categories.name,
      entry.sizes.size,
      entry.customer_types?.name || 'N/A',
      ...customFields.map(cf => entry.customFieldValues?.[cf.id] || 'N/A'),
      entry.notes || '',
      makeImageCell((entry.gd_entry_images || []).map(img => img.image_url)),
      formatDateTime(entry.created_at!)
    ]);

    exportToPDFViaHTML({
      title: 'GD Reports',
      subtitle: `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`,
      columns: [
        { header: 'S.NO', width: '40px', align: 'center' },
        { header: 'SHOP', width: '10%' },
        { header: 'CATEGORY', width: '10%' },
        { header: 'SIZE', width: '6%', align: 'center' },
        { header: 'CUSTOMER TYPE', width: '10%' },
        ...customFields.map(cf => ({ header: cf.name.toUpperCase(), width: '8%' })),
        { header: 'NOTES' },
        { header: 'IMAGE', width: '12%', align: 'center' as const },
        { header: 'DATE AND TIME', width: '11%' }
      ],
      rows,
      orientation: 'landscape',
    });

    toast.success('PDF export opened');
  };

  const formatTime12Hour = (date: Date) => {
    return format(date, 'yyyy-MM-dd hh:mm a');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Helper function to fetch image as base64
  const fetchImageAsBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching image:', error);
      return null;
    }
  };

  // Enhanced Excel export with image thumbnails embedded
  const exportExcelMulti = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      toast.info('Preparing Excel export with embedded image thumbnails...');

      const wb = XLSX.utils.book_new();

      // Prepare data for export with embedded images
      const exportData = await Promise.all(
        filteredEntries.map(async (entry) => {
          const baseData: Record<string, any> = {
            Date: formatTime12Hour(new Date(entry.created_at)),
            Shop: entry.shops.name,
            Category: entry.categories.name,
            Size: entry.sizes.size,
            'Customer Type': entry.customer_types?.name || 'Not specified',
          };
          customFields.forEach(cf => {
            baseData[cf.name] = entry.customFieldValues?.[cf.id] || 'N/A';
          });
          baseData['Reporter'] = entry.employee_name || 'Unknown';
          baseData['Notes'] = entry.notes || '';

          // Process up to 3 images for this entry
          if (entry.gd_entry_images.length > 0) {
            try {
              const imagePromises = entry.gd_entry_images.slice(0, 3).map(async (img, index) => {
                const base64 = await fetchImageAsBase64(img.image_url);
                if (base64) {
                  // Create a small thumbnail representation for Excel
                  return {
                    name: img.image_name || `Image ${index + 1}`,
                    data: base64,
                    url: img.image_url
                  };
                }
                return null;
              });

              const imageData = await Promise.all(imagePromises);
              const validImages = imageData.filter(img => img !== null);

              if (validImages.length > 0) {
                // Create a cell with image thumbnails data
                const imageInfo = validImages.map(img => `📸 ${img?.name || 'Image'}`).join(' | ');
                return {
                  ...baseData,
                  Images: `${validImages.length} embedded: ${imageInfo}`,
                  ImageThumbnails: validImages // Store for potential embedding
                };
              }
            } catch (error) {
              if (import.meta.env.DEV) console.error('Error processing images for entry:', entry.id, error);
            }
          }

          return {
            ...baseData,
            Images: 'No images',
            ImageThumbnails: []
          };
        })
      );

      // Create enhanced workbook with image data
      const createWorksheetWithImageThumbnails = (name: string, data: any[]) => {
        // Clean data for export (remove thumbnail data from sheet)
        const cleanData = data.map(({ ImageThumbnails, ...rest }) => rest);
        const ws = XLSX.utils.json_to_sheet(cleanData, { skipHeader: false });

        // Enhanced styling for image cells
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const imageCell = ws[XLSX.utils.encode_cell({ r: R, c: 6 })]; // Images column (now at index 6)
          if (imageCell && imageCell.v && imageCell.v.includes('embedded')) {
            imageCell.s = {
              fill: { fgColor: { rgb: "E3F2FD" } },
              font: { sz: 10, color: { rgb: "1976D2" } },
              alignment: { wrapText: true, vertical: "center" }
            };
          }
        }

        // Auto-width and formatting
        const colWidths = [
          { wch: 18 }, // Date
          { wch: 15 }, // Shop
          { wch: 15 }, // Category
          { wch: 10 }, // Size
          { wch: 15 }, // Customer Type
          ...customFields.map(() => ({ wch: 15 })),
          { wch: 15 }, // Reporter
          { wch: 30 }, // Notes
          { wch: 40 }, // Images (wider for thumbnail info)
        ];
        ws['!cols'] = colWidths;

        // Set row heights for better display
        ws['!rows'] = [{ hpx: 25 }, ...data.map(() => ({ hpx: 45 }))];
        ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

        return ws;
      };

      // Create sheets with enhanced image data
      const overallWs = createWorksheetWithImageThumbnails('Overall Report', exportData);
      XLSX.utils.book_append_sheet(wb, overallWs, 'Overall Report');

      // Shop-wise sheets
      const uniqueShops = [...new Set((exportData as any[]).map((d: any) => d.Shop).filter(Boolean))].sort();
      for (const shop of uniqueShops) {
        const shopData = (exportData as any[]).filter((d: any) => d.Shop === shop);
        const sheetName = `Shop - ${shop}`.slice(0, 31);
        const ws = createWorksheetWithImageThumbnails(sheetName, shopData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Category-wise sheets
      const uniqueCategories = [...new Set((exportData as any[]).map((d: any) => d.Category).filter(Boolean))].sort();
      for (const category of uniqueCategories) {
        const categoryData = (exportData as any[]).filter((d: any) => d.Category === category);
        const sheetName = `Category - ${category}`.slice(0, 31);
        const ws = createWorksheetWithImageThumbnails(sheetName, categoryData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const fileName = `gd_report_with_images_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName, { compression: true });

      toast.success(`Excel report exported with embedded image thumbnails! ${filteredEntries.length} entries across multiple sheets`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel. Please try again.');
    }
  };

  const [isExportingWithImages, setIsExportingWithImages] = useState(false);

  const exportExcelAdvanced = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      setIsExportingWithImages(true);
      toast.info('Generating Excel with embedded images... This may take a moment.');

      const { data, error } = await supabase.functions.invoke('export-excel-with-images', {
        body: {
          entries: filteredEntries.map(entry => ({
            ...entry,
            gd_entry_images: entry.gd_entry_images.slice(0, 3)
          }))
        }
      });

      if (error) throw error;

      // Handle the Excel blob response
      let blob: Blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
      } else {
        // If it's a string or other format, try to convert
        blob = new Blob([data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gd_report_with_images_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Excel exported with ${filteredEntries.length} entries and embedded images!`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error with advanced export:', error);
      toast.error('Failed to export with images. Using fallback method...');
      exportExcelMulti();
    } finally {
      setIsExportingWithImages(false);
    }
  };

  // Send GD alert manually
  const sendGDAlert = async () => {
    try {
      toast.info('Checking thresholds and sending alerts...');
      
      const { data, error } = await supabase.functions.invoke('send-gd-alert', {
        body: {
          checkPeriod: 'daily',
          threshold: 5
        }
      });

      if (error) throw error;

      if (data.alertShops?.length > 0) {
        toast.success(`Alert sent for ${data.alertShops.length} shop(s) exceeding threshold`);
      } else {
        toast.info('No shops exceeded the threshold. No alerts sent.');
      }
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error sending alert:', error);
      toast.error(error.message || 'Failed to send alert');
    }
  };

  const exportReportPDF = async () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare data with image cells
      const exportData = filteredEntries.map(entry => {
        const base: Record<string, any> = {
          Date: formatTime12Hour(new Date(entry.created_at)),
          Shop: entry.shops.name,
          Category: entry.categories.name,
          Size: entry.sizes.size,
          'Customer Type': entry.customer_types?.name || 'Not specified',
        };
        customFields.forEach(cf => {
          base[cf.name] = entry.customFieldValues?.[cf.id] || 'N/A';
        });
        base['Reporter'] = entry.employee_name || 'Unknown';
        base['Notes'] = entry.notes || '';
        base['Images'] = makeImageCell((entry.gd_entry_images || []).map(img => img.image_url));
        return base;
      });

      const columns = [
        { header: 'DATE', width: '11%' },
        { header: 'SHOP', width: '9%' },
        { header: 'CATEGORY', width: '9%' },
        { header: 'SIZE', width: '6%', align: 'center' as const },
        { header: 'CUSTOMER TYPE', width: '9%' },
        ...customFields.map(cf => ({ header: cf.name.toUpperCase(), width: '7%' })),
        { header: 'REPORTER', width: '9%' },
        { header: 'NOTES' },
        { header: 'IMAGE', width: '12%', align: 'center' as const }
      ];

      const toRow = (d: Record<string, any>): CellContent[] => [
        d.Date, d.Shop, d.Category, d.Size, d['Customer Type'],
        ...customFields.map(cf => d[cf.name] || 'N/A'),
        d.Reporter, d.Notes, d.Images
      ];

      // Build sections: Overall + Shop-wise + Category-wise
      type Section = { title: string; rows: CellContent[][] };
      const sections: Section[] = [];

      // Overall
      sections.push({
        title: 'Overall Report',
        rows: exportData.map((d) => toRow(d))
      });

      // Shop-wise
      const uniqueShops = [...new Set(exportData.map(d => d.Shop))].sort();
      for (const shop of uniqueShops) {
        const shopData = exportData.filter(d => d.Shop === shop);
        sections.push({
          title: `Shop - ${shop}`,
          rows: shopData.map((d) => toRow(d))
        });
      }

      // Category-wise
      const uniqueCategories = [...new Set(exportData.map(d => d.Category))].sort();
      for (const category of uniqueCategories) {
        const catData = exportData.filter(d => d.Category === category);
        sections.push({
          title: `Category - ${category}`,
          rows: catData.map((d) => toRow(d))
        });
      }

      // Use multi-section HTML PDF export
      exportMultiSectionPDFViaHTML({
        title: 'GD Multi-Sheet Report',
        subtitle: `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')} | Total: ${filteredEntries.length} entries`,
        columns,
        sections,
        orientation: 'landscape',
      });

      toast.success(`PDF report opened! ${filteredEntries.length} entries across ${sections.length} sections`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error exporting multi-sheet PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const clearFilters = () => {
    setSelectedShop('all');
    setSelectedCategory('all');
    setSelectedSize('all');
    setSelectedCustomerType('all');
    setDateFilter('today');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading reports...</div>;
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="w-full">
        {/* Header content was already replaced correctly above, just need to ensure surrounding structure is valid */}
        {/* ... checking previous edit ... */}
        {/* The previous edit seems to have replaced CardHeader content but maybe messed up braces if not careful */}
        {/* Re-applying the header section cleanly to be safe */}
        <CardHeader className="rounded-t-2xl border-b bg-gradient-to-r from-background to-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80 flex items-center gap-2">
                GD Reports
                {!isOnline && (
                  <span className="text-xs font-normal text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 flex items-center gap-1.5 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    Offline Mode
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="text-xs font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 shadow-sm">
                    {pendingCount} pending
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground/90">
                Generated report for {entries.length} goods damaged entries
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Re-adding export buttons if they were lost or just ensuring closure */}
              <Button onClick={exportTableExcel} variant="outline" size="sm" className="h-9 gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button onClick={exportTablePDF} variant="outline" size="sm" className="h-9 gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile-friendly grid layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Shop</Label>
              <Select value={selectedShop} onValueChange={setSelectedShop}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shops</SelectItem>
                  {shops.map(shop => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Size</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {sizes.map(size => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Customer Type</Label>
              <Select value={selectedCustomerType} onValueChange={setSelectedCustomerType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {customerTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-sm font-medium">Reporter</Label>
              <Input
                type="text"
                placeholder="Search by reporter name..."
                value={reporterSearch}
                onChange={(e) => setReporterSearch(e.target.value)}
                className="w-full"
              />
            </div>
          </div>


          {dateFilter === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2 min-w-0">
                <Label className="text-sm font-medium">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customDateFrom ? format(customDateFrom, 'PPP') : 'Pick a date'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 min-w-0">
                <Label className="text-sm font-medium">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customDateTo ? format(customDateTo, 'PPP') : 'Pick a date'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        if (date > today) return true;
                        if (customDateFrom) {
                          return date < customDateFrom;
                        }
                        return false;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button onClick={clearFilters} variant="outline" className="w-full sm:w-auto">
              Clear Filters
            </Button>
            <Button onClick={exportExcelMulti} className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export Excel with Image Info ({filteredEntries.length})</span>
            </Button>
            <Button 
              onClick={exportExcelAdvanced} 
              variant="secondary" 
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
              disabled={isExportingWithImages}
            >
              {isExportingWithImages ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
              ) : (
                <Image className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">
                {isExportingWithImages ? 'Exporting...' : `Excel with Embedded Images (${filteredEntries.length})`}
              </span>
            </Button>
            <Button onClick={exportReportPDF} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Export PDF ({filteredEntries.length})</span>
            </Button>
            {isAdmin && (
              <Button onClick={sendGDAlert} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto border-orange-200 text-orange-600 hover:bg-orange-50">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Send Alert</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">GD Reports</CardTitle>
              <CardDescription className="text-sm">
                Showing {viewMode === 'table' ? tableFilteredEntries.length : filteredEntries.length} of {entries.length} entries
                {viewMode === 'table' && (tableShopFilters.length > 0 || tableCategoryFilters.length > 0 || tableSizeFilters.length > 0 || tableCustomerTypeFilters.length > 0) && (
                  <span className="text-primary ml-1">(column filters active)</span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Delete Button - Admin only */}
              {isAdmin && selectedEntries.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1" disabled={isDeleting}>
                      <Trash2 className="h-4 w-4" />
                      Delete ({selectedEntries.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete {selectedEntries.size} Entries?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the selected entries along with their images and voice notes. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {/* Table Export Buttons - only show in table view */}
              {viewMode === 'table' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTableExcel}
                    className="gap-1"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTablePDF}
                    className="gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </>
              )}
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Summary
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-gradient-primary">GD Summary</DialogTitle>
                  </DialogHeader>
                  {summary ? (
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg">
                        <div className="text-3xl font-bold text-gradient-primary">{summary.totalEntries}</div>
                        <div className="text-sm text-muted-foreground">Total Entries</div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Shop</h4>
                          <div className="space-y-1">
                            {Object.entries(summary.byShop).map(([shop, count]) => (
                              <div key={shop} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                                <span>{shop}</span>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Category</h4>
                          <div className="space-y-1">
                            {Object.entries(summary.byCategory).map(([category, count]) => (
                              <div key={category} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                                <span>{category}</span>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Size</h4>
                          <div className="space-y-1">
                            {Object.entries(summary.bySize).map(([size, count]) => (
                              <div key={size} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                                <span>{size}</span>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Customer Type</h4>
                          <div className="space-y-1">
                            {Object.entries(summary.byCustomerType).map(([type, count]) => (
                              <div key={type} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                                <span>{type}</span>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gradient-secondary">By Notes</h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {Object.entries(summary.byNotes)
                              .sort(([, a], [, b]) => b - a)
                              .map(([note, count]) => (
                                <div key={note} className="flex justify-between text-sm p-2 bg-muted/50 rounded gap-2">
                                  <span className="flex-1 truncate" title={note}>{note}</span>
                                  <span className="font-medium flex-shrink-0">{count}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">From:</span>
                          <span className="font-medium">{summary.firstDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">To:</span>
                          <span className="font-medium">{summary.lastDate}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No GD entries found.
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries found matching the selected filters.
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="inline-block min-w-full align-middle">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {isAdmin && (
                        <TableHead className="w-10 text-center">
                          <Checkbox
                            checked={selectedEntries.size === paginatedEntries.length && paginatedEntries.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-14 text-center font-semibold text-primary whitespace-nowrap">S.NO</TableHead>
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[100px]">
                        <ColumnFilterDropdown
                          title="SHOP"
                          values={uniqueShopNames}
                          selectedFilters={tableShopFilters}
                          setFilters={setTableShopFilters}
                          sortKey="shop"
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[100px]">
                        <ColumnFilterDropdown
                          title="CATEGORY"
                          values={uniqueCategoryNames}
                          selectedFilters={tableCategoryFilters}
                          setFilters={setTableCategoryFilters}
                          sortKey="category"
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[80px]">
                        <ColumnFilterDropdown
                          title="SIZE"
                          values={uniqueSizeNames}
                          selectedFilters={tableSizeFilters}
                          setFilters={setTableSizeFilters}
                          sortKey="size"
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[130px]">
                        <ColumnFilterDropdown
                          title="CUSTOMER TYPE"
                          values={uniqueCustomerTypeNames}
                          selectedFilters={tableCustomerTypeFilters}
                          setFilters={setTableCustomerTypeFilters}
                          sortKey="customerType"
                        />
                      </TableHead>
                      {customFields.map(cf => (
                        <TableHead key={cf.id} className="font-semibold text-primary whitespace-nowrap min-w-[100px]">
                          <div className="flex items-center">{cf.name.toUpperCase()}</div>
                        </TableHead>
                      ))}
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[150px] cursor-pointer" onClick={() => handleSort('notes')}>
                        <div className="flex items-center">
                          NOTES
                          {getSortIcon('notes')}
                        </div>
                      </TableHead>
                      <TableHead className="w-16 text-center font-semibold text-primary whitespace-nowrap">
                        IMAGE
                      </TableHead>
                      <TableHead className="min-w-[200px] text-center font-semibold text-primary whitespace-nowrap">
                        VOICE
                      </TableHead>
                      <TableHead className="font-semibold text-primary whitespace-nowrap min-w-[140px] cursor-pointer" onClick={() => handleSort('date')}>
                        <div className="flex items-center">
                          DATE AND TIME
                          {getSortIcon('date')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((entry, index) => (
                      <TableRow key={entry.id} className={`hover:bg-muted/30 ${selectedEntries.has(entry.id) ? 'bg-primary/5' : ''}`}>
                        {isAdmin && (
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedEntries.has(entry.id)}
                              onCheckedChange={() => toggleSelectEntry(entry.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-center font-medium">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap text-center">{entry.shops.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-center">{entry.categories.name}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">{entry.sizes.size}</TableCell>
                        <TableCell className="whitespace-nowrap text-center">{entry.customer_types?.name || 'N/A'}</TableCell>
                        {customFields.map(cf => (
                          <TableCell key={cf.id} className="whitespace-nowrap text-center">
                            {entry.customFieldValues?.[cf.id] || 'N/A'}
                          </TableCell>
                        ))}
                        <TableCell className="max-w-[200px]">
                          {entry.notes ? (
                            <NoteViewerModal notes={entry.notes} />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.gd_entry_images && entry.gd_entry_images.length > 0 && (
                            <ImageDisplay images={entry.gd_entry_images} />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.voice_note_url ? (
                            <VoiceNotePlayer voiceUrl={entry.voice_note_url} compact />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-center">
                          {formatDateTime(entry.created_at!)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {tableFilteredEntries.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>per page</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, tableFilteredEntries.length)} of {tableFilteredEntries.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        ««
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        «
                      </Button>
                      <span className="px-2 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                      >
                        »
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                      >
                        »»
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 sm:p-4 space-y-3 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs">{entry.shops.name}</Badge>
                      <Badge variant="secondary" className="text-xs">{entry.categories.name}</Badge>
                      <Badge variant="outline" className="text-xs">{entry.sizes.size}</Badge>
                      {customFields.map(cf => {
                        const val = entry.customFieldValues?.[cf.id];
                        return val ? (
                          <Badge key={cf.id} variant="secondary" className="text-xs">
                            {cf.name}: {val}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                      {formatTime12Hour(new Date(entry.created_at))}
                    </span>
                  </div>
                  <div className="text-sm min-w-0">
                    <span className="font-medium">Reporter:</span>{' '}
                    <span className="break-words">{entry.employee_name || 'Unknown'}</span>
                  </div>
                  <div className="text-sm min-w-0 tamil-content">
                    <span className="font-medium">Notes:</span>{' '}
                    <span className="break-words tamil">
                      {entry.notes}
                    </span>
                  </div>
                  {entry.voice_note_url && (
                    <div className="text-sm min-w-0">
                      <span className="font-medium">Voice Note:</span>
                      <div className="mt-2">
                        <VoiceNotePlayer voiceUrl={entry.voice_note_url} />
                      </div>
                    </div>
                  )}
                  {entry.gd_entry_images.length > 0 && (
                    <div className="text-sm min-w-0">
                      <span className="font-medium">Images:</span>
                      <div className="mt-2">
                        <ImageDisplay images={entry.gd_entry_images} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
