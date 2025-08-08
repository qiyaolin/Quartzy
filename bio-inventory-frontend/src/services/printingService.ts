import { buildApiUrl } from '../config/api.ts';

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
  private getToken(): string {
    // Get token from localStorage - same pattern used in other components
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  }
  /**
   * Queue a new print job
   */
  async queuePrintJob(data: CreatePrintJobRequest): Promise<PrintJob> {
    try {
      const response = await fetch(buildApiUrl('/api/printing/api/queue-job/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.getToken()}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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
      const url = status 
        ? buildApiUrl(`/api/printing/api/jobs/?status=${encodeURIComponent(status)}`)
        : buildApiUrl('/api/printing/api/jobs/');
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${this.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.results || data;
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
      const response = await fetch(buildApiUrl(`/api/printing/api/jobs/${jobId}/`), {
        headers: {
          'Authorization': `Token ${this.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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
      const response = await fetch(buildApiUrl(`/api/printing/api/jobs/${jobId}/retry/`), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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
      const response = await fetch(buildApiUrl('/api/printing/api/stats/'), {
        headers: {
          'Authorization': `Token ${this.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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