import React, { useState, useEffect, useContext } from 'react';
import { 
  FileText, Upload, Download, Search, Filter, Calendar,
  Clock, User, CheckCircle, AlertTriangle, Send, Eye,
  Archive, Link, Trash2, RefreshCw, BookOpen, Globe
} from 'lucide-react';
import { AuthContext } from './AuthContext';
import {
  PaperSubmission,
  MeetingInstance,
  PaginatedResponse
} from '../types/intelligentMeeting';
import {
  journalClubApi,
  meetingInstanceApi
} from '../services/intelligentMeetingApi';

/**
 * Journal Club Hub Component
 * Central interface for managing journal club papers and materials
 * All content in English as per system requirements
 */

interface JournalClubHubProps {
  className?: string;
  meetingId?: string; // Optional specific meeting focus
}

const JournalClubHub: React.FC<JournalClubHubProps> = ({ className = '', meetingId }) => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('JournalClubHub must be used within an AuthProvider');
  }
  const { token } = authContext;

  // State management
  const [activeTab, setActiveTab] = useState<'current' | 'archive' | 'upload'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [currentMeeting, setCurrentMeeting] = useState<MeetingInstance | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<PaperSubmission | null>(null);
  const [paperArchive, setPaperArchive] = useState<PaperSubmission[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Upload state
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlForm, setUrlForm] = useState({
    title: '',
    url: '',
    authors: '',
    journal: '',
    year: new Date().getFullYear(),
    doi: ''
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [presenterFilter, setPresenterFilter] = useState('');

  // Load initial data
  useEffect(() => {
    if (token) {
      loadCurrentData();
      loadPaperArchive();
    }
  }, [token, meetingId]);

  const loadCurrentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current or next journal club meeting
      const meetingsResponse = await meetingInstanceApi.getMeetings(token, {
        dateFrom: new Date().toISOString().split('T')[0],
        type: 'Journal Club'
      });

      const nextJournalClub = meetingId
        ? meetingsResponse.results.find(m => m.id === meetingId)
        : meetingsResponse.results[0];

      if (nextJournalClub) {
        setCurrentMeeting(nextJournalClub);
        
        // Get current submission for this meeting
        const submission = await journalClubApi.getPaperSubmission(token, nextJournalClub.id);
        setCurrentSubmission(submission);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load current data');
      console.error('Error loading current data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPaperArchive = async () => {
    try {
      setArchiveLoading(true);
      
      const params = {
        searchTerm: searchTerm || undefined,
        dateFrom: dateFilter || undefined,
        presenterId: presenterFilter ? parseInt(presenterFilter) : undefined
      };

      const archiveData = await journalClubApi.getPaperArchive(token, params);
      setPaperArchive(archiveData.results);

    } catch (err) {
      console.error('Error loading paper archive:', err);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile || !currentMeeting) return;

    try {
      setUploading(true);
      setError(null);

      const metadata = {
        title: selectedFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        authors: '',
        journal: '',
      };

      const result = await journalClubApi.uploadPaper(token, currentMeeting.id, selectedFile, metadata);
      setCurrentSubmission(result);
      setSelectedFile(null);
      setSuccess('Paper uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Switch to current tab to show uploaded paper
      setActiveTab('current');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload paper');
    } finally {
      setUploading(false);
    }
  };

  // Handle URL submission
  const handleUrlSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMeeting) return;

    try {
      setUploading(true);
      setError(null);

      const result = await journalClubApi.submitPaperUrl(token, currentMeeting.id, urlForm);
      setCurrentSubmission(result);
      
      // Reset form
      setUrlForm({
        title: '',
        url: '',
        authors: '',
        journal: '',
        year: new Date().getFullYear(),
        doi: ''
      });

      setSuccess('Paper URL submitted successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Switch to current tab to show submitted paper
      setActiveTab('current');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit paper URL');
    } finally {
      setUploading(false);
    }
  };

  // Handle paper distribution
  const handleDistributePaper = async () => {
    if (!currentMeeting || !currentSubmission) return;

    try {
      setLoading(true);
      await journalClubApi.distributePaper(token, currentMeeting.id);
      setSuccess('Paper distributed to all members!');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to distribute paper');
    } finally {
      setLoading(false);
    }
  };

  // Get submission status info
  const getSubmissionStatus = () => {
    if (!currentMeeting) return { status: 'no-meeting', message: 'No upcoming Journal Club meeting' };
    if (!currentSubmission) return { status: 'pending', message: 'Paper submission required' };
    if (!currentSubmission.isApproved) return { status: 'review', message: 'Paper under admin review' };
    return { status: 'ready', message: 'Paper ready for distribution' };
  };

  // Calculate days until meeting
  const getDaysUntilMeeting = (): number => {
    if (!currentMeeting) return 0;
    const today = new Date();
    const meetingDate = new Date(currentMeeting.date);
    const diffTime = meetingDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Render current submission status
  const renderCurrentSubmission = () => {
    const status = getSubmissionStatus();
    const daysUntil = getDaysUntilMeeting();

    return (
      <div className="space-y-6">
        {/* Meeting Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentMeeting ? 'Next Journal Club' : 'No Upcoming Journal Club'}
                </h3>
                {currentMeeting && (
                  <p className="text-sm text-gray-600">
                    {currentMeeting.date} • {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                  </p>
                )}
              </div>
            </div>

            {currentMeeting && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                status.status === 'ready' ? 'bg-green-100 text-green-800' :
                status.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                status.status === 'pending' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status.message}
              </div>
            )}
          </div>

          {currentMeeting && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                <span>{currentMeeting.date}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                <span>Duration: 60 minutes</span>
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                <span>
                  Presenter: {currentMeeting.presenters.length > 0 
                    ? `${currentMeeting.presenters[0].user.first_name} ${currentMeeting.presenters[0].user.last_name}`
                    : 'Not assigned'
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Current Submission */}
        {currentSubmission ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  currentSubmission.isApproved ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <FileText className={`w-6 h-6 ${
                    currentSubmission.isApproved ? 'text-green-600' : 'text-yellow-600'
                  }`} />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900">Submitted Paper</h4>
                  <p className="text-sm text-gray-600">
                    Submitted on {new Date(currentSubmission.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {currentSubmission.isApproved && (
                <button
                  onClick={handleDistributePaper}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Distribute to All
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h5 className="font-medium text-gray-900">{currentSubmission.title}</h5>
                {currentSubmission.authors && (
                  <p className="text-sm text-gray-600">Authors: {currentSubmission.authors}</p>
                )}
                {currentSubmission.journal && (
                  <p className="text-sm text-gray-600">
                    Published in: {currentSubmission.journal} {currentSubmission.year && `(${currentSubmission.year})`}
                  </p>
                )}
              </div>

              {currentSubmission.doi && (
                <div className="flex items-center text-sm text-gray-600">
                  <Globe className="w-4 h-4 mr-2" />
                  <span>DOI: {currentSubmission.doi}</span>
                </div>
              )}

              {currentSubmission.url && (
                <div className="flex items-center text-sm">
                  <Link className="w-4 h-4 mr-2 text-blue-600" />
                  <a 
                    href={currentSubmission.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View Online
                  </a>
                </div>
              )}

              {currentSubmission.file && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>PDF File Attached</span>
                  </div>
                  <button className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                </div>
              )}

              {!currentSubmission.isApproved && currentSubmission.adminNotes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Admin Notes:</p>
                      <p className="text-sm text-yellow-700">{currentSubmission.adminNotes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          currentMeeting && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                  <div>
                    <h4 className="text-lg font-medium text-yellow-800">Paper Submission Required</h4>
                    <p className="text-sm text-yellow-700">
                      {daysUntil <= 3 
                        ? 'Urgent: Submit your paper as soon as possible!' 
                        : `Please submit your paper for the Journal Club in ${daysUntil} days.`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Now
                </button>
              </div>
            </div>
          )
        )}
      </div>
    );
  };

  // Render upload interface
  const renderUploadInterface = () => {
    return (
      <div className="space-y-6">
        {/* Upload Mode Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Journal Club Paper</h3>
          
          <div className="flex rounded-md border border-gray-300 overflow-hidden mb-6">
            <button
              onClick={() => setUploadMode('file')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                uploadMode === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload PDF File
            </button>
            <button
              onClick={() => setUploadMode('url')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                uploadMode === 'url'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Link className="w-4 h-4 inline mr-2" />
              Submit URL
            </button>
          </div>

          {/* File Upload */}
          {uploadMode === 'file' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-sm text-gray-600 mb-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="font-medium text-blue-600 hover:text-blue-500">
                        Click to upload
                      </span>
                      <span> or drag and drop</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX up to 10MB</p>
                </div>
              </div>

              {selectedFile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-800">{selectedFile.name}</span>
                      <span className="text-xs text-blue-600 ml-2">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading || !currentMeeting}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Paper'}
                </button>
              </div>
            </div>
          )}

          {/* URL Submission */}
          {uploadMode === 'url' && (
            <form onSubmit={handleUrlSubmission} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Title *
                  </label>
                  <input
                    type="text"
                    value={urlForm.title}
                    onChange={(e) => setUrlForm(prev => ({...prev, title: e.target.value}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Enter paper title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper URL *
                  </label>
                  <input
                    type="url"
                    value={urlForm.url}
                    onChange={(e) => setUrlForm(prev => ({...prev, url: e.target.value}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="https://..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Authors
                  </label>
                  <input
                    type="text"
                    value={urlForm.authors}
                    onChange={(e) => setUrlForm(prev => ({...prev, authors: e.target.value}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Smith, J., Johnson, A."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Journal
                  </label>
                  <input
                    type="text"
                    value={urlForm.journal}
                    onChange={(e) => setUrlForm(prev => ({...prev, journal: e.target.value}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Nature, Science, Cell..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={urlForm.year}
                    onChange={(e) => setUrlForm(prev => ({...prev, year: parseInt(e.target.value)}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    DOI
                  </label>
                  <input
                    type="text"
                    value={urlForm.doi}
                    onChange={(e) => setUrlForm(prev => ({...prev, doi: e.target.value}))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="10.1038/nature..."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading || !urlForm.title || !urlForm.url || !currentMeeting}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {uploading ? 'Submitting...' : 'Submit Paper'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // Render paper archive
  const renderPaperArchive = () => {
    return (
      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search papers by title, author, or journal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Filter by date"
              />
              
              <button
                onClick={loadPaperArchive}
                disabled={archiveLoading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Archive Results */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Paper Archive</h3>
          
          {archiveLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : paperArchive.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Papers Found</h4>
              <p className="text-gray-600">
                {searchTerm ? 'Try adjusting your search terms' : 'No papers in the archive yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paperArchive.map((paper, index) => (
                <div key={paper.meetingInstanceId || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 mb-1">{paper.title}</h5>
                      
                      {paper.authors && (
                        <p className="text-sm text-gray-600 mb-1">Authors: {paper.authors}</p>
                      )}
                      
                      {paper.journal && (
                        <p className="text-sm text-gray-600 mb-2">
                          Published in: {paper.journal} {paper.year && `(${paper.year})`}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>{new Date(paper.submittedAt).toLocaleDateString()}</span>
                        </div>
                        
                        {paper.doi && (
                          <div className="flex items-center">
                            <Globe className="w-3 h-3 mr-1" />
                            <span>DOI: {paper.doi}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </a>
                      )}
                      
                      {paper.file && (
                        <button className="inline-flex items-center px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded hover:bg-green-50">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !currentMeeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'current', label: 'Current Submission', icon: FileText },
    { id: 'upload', label: 'Upload Paper', icon: Upload },
    { id: 'archive', label: 'Paper Archive', icon: Archive }
  ] as const;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Journal Club Hub</h2>
          <p className="text-gray-600">Manage papers, submissions, and materials for journal club meetings</p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'current' && renderCurrentSubmission()}
          {activeTab === 'upload' && renderUploadInterface()}
          {activeTab === 'archive' && renderPaperArchive()}
        </div>
      </div>
    </div>
  );
};

export default JournalClubHub;