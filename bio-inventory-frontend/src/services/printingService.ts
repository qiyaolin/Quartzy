import api from '../config/api';

export interface LabelData {
  itemName: string;
  barcode: string;
  itemId?: string;
  customText?: string;
  fontSize?: number;
  isBold?: boolean;
  [key: string]: any;
}

export interface PrintJob {
  id: number;
  label_data: LabelData;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requested_by: number;
  requested_by_username: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  can_retry: boolean;
  print_server_id?: string;
}

export interface PrintJobStats {
  total_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  user_jobs?: number;
}

export interface CreatePrintJobRequest {
  label_data: LabelData;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

class PrintingService {
  /**
   * Queue a new print job
   */
  async queuePrintJob(data: CreatePrintJobRequest): Promise<PrintJob> {
    try {
      const response = await api.post('/printing/api/queue-job/', data);
      return response.data;
    } catch (error) {
      console.error('Failed to queue print job:', error);
      throw error;
    }
  }

  /**
   * Get user's print jobs
   */
  async getPrintJobs(status?: string): Promise<PrintJob[]> {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/printing/api/jobs/', { params });
      return response.data.results || response.data;
    } catch (error) {
      console.error('Failed to fetch print jobs:', error);
      throw error;
    }
  }

  /**
   * Get specific print job by ID
   */
  async getPrintJob(jobId: number): Promise<PrintJob> {
    try {
      const response = await api.get(`/printing/api/jobs/${jobId}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch print job:', error);
      throw error;
    }
  }

  /**
   * Retry a failed print job
   */
  async retryPrintJob(jobId: number): Promise<PrintJob> {
    try {
      const response = await api.post(`/printing/api/jobs/${jobId}/retry/`);
      return response.data;
    } catch (error) {
      console.error('Failed to retry print job:', error);
      throw error;
    }
  }

  /**
   * Get printing statistics
   */
  async getPrintStats(): Promise<PrintJobStats> {
    try {
      const response = await api.get('/printing/api/stats/');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch print stats:', error);
      throw error;
    }
  }

  /**
   * Convenience method to print a label for an item
   */
  async printItemLabel(
    itemName: string, 
    barcode: string, 
    options: {
      itemId?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      customText?: string;
      fontSize?: number;
      isBold?: boolean;
    } = {}
  ): Promise<PrintJob> {
    const labelData: LabelData = {
      itemName,
      barcode,
      ...options
    };

    return this.queuePrintJob({
      label_data: labelData,
      priority: options.priority || 'normal'
    });
  }

  /**
   * Check if centralized printing is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.getPrintStats();
      return true;
    } catch (error) {
      console.warn('Centralized printing service not available:', error);
      return false;
    }
  }
}

export const printingService = new PrintingService();
export default printingService;