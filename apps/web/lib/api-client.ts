/**
 * API Client
 * 
 * Client for making requests to the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  skipAuth?: boolean; // Skip automatic token injection
}

/**
 * Custom API Error class with proper typing
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: any;

  constructor(message: string, status: number, statusText: string = '', data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Build base URL
    let baseUrl = this.baseUrl;
    if (!baseUrl.endsWith('/')) {
      baseUrl = baseUrl.replace(/\/+$/, '');
    }
    
    // Combine base URL and endpoint
    const fullUrl = `${baseUrl}${normalizedEndpoint}`;
    
    // Use URL constructor for proper URL handling
    try {
      const url = new URL(fullUrl);
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      
      return url.toString();
    } catch (error) {
      // Fallback: manual URL construction if URL constructor fails
      console.error('❌ [API CLIENT] URL construction error:', error, { baseUrl, endpoint, fullUrl });
      
      let url = fullUrl;
      if (params && Object.keys(params).length > 0) {
        const searchParams = Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&');
        url = `${url}${url.includes('?') ? '&' : '?'}${searchParams}`;
      }
      
      return url;
    }
  }

  /**
   * Get headers with automatic token injection
   */
  private getHeaders(options?: RequestOptions): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add auth token if available and not skipped
    if (!options?.skipAuth) {
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers as HeadersInit;
  }

  /**
   * Check if error should be logged (skip 401 errors)
   */
  private shouldLogError(status: number): boolean {
    return status !== 401;
  }

  /**
   * Handle 401 Unauthorized errors - clear auth and redirect
   */
  private handleUnauthorized() {
    if (typeof window === 'undefined') return;
    
    console.warn('⚠️ [API CLIENT] Unauthorized (401) - clearing auth data');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    // Trigger auth update event to notify AuthContext
    window.dispatchEvent(new Event('auth-updated'));
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions, retryCount = 0): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    const timeout = 30000; // 30 seconds timeout
    
    console.log('🌐 [API CLIENT] GET request:', { url, endpoint, baseUrl: this.baseUrl });
    
    let response: Response;
    try {
      // Ստեղծում ենք timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(options),
          cache: 'no-store', // Disable caching for server components
          signal: controller.signal,
          ...options,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout: API server did not respond within ${timeout / 1000} seconds. URL: ${url}`);
        }
        throw fetchError;
      }
      
      // Լոգավորում ենք response status-ը անվտանգ կերպով
      try {
        console.log('🌐 [API CLIENT] GET response status:', response.status, response.statusText || '');
      } catch (logError) {
        // Եթե console.log-ը ձախողվի, շարունակում ենք
        console.warn('⚠️ [API CLIENT] Failed to log response status');
      }
    } catch (networkError: any) {
      // Ստուգում ենք timeout սխալը
      if (networkError.message?.includes('timeout') || networkError.message?.includes('Request timeout')) {
        console.error('⏱️ [API CLIENT] Request timeout:', networkError.message);
        throw networkError;
      }
      
      console.error('❌ [API CLIENT] Network error during fetch:', networkError);
      
      // Ստուգում ենք, արդյոք սա կապի մերժման սխալ է
      const isConnectionRefused = networkError.message?.includes('Failed to fetch') || 
                                  networkError.message?.includes('ERR_CONNECTION_REFUSED') ||
                                  networkError.message?.includes('NetworkError') ||
                                  networkError.message?.includes('Network request failed');
      
      if (isConnectionRefused) {
        const errorMessage = `⚠️ API սերվերը հասանելի չէ!\n\n` +
          `Չհաջողվեց միանալ ${this.baseUrl}\n\n` +
          `Լուծում:\n` +
          `1. Համոզվեք, որ API սերվերը գործարկված է\n` +
          `2. Գործարկեք սերվերը հրամանով: npm run dev:api (նախագծի արմատից)\n` +
          `   կամ: cd apps/api && npm run dev\n` +
          `3. Ստուգեք, որ ${this.baseUrl.split(':').pop() || '3001'} պորտը զբաղված չէ այլ գործընթացով\n\n` +
          `Հարցման URL: ${url}`;
        
        console.error('❌ [API CLIENT]', errorMessage);
        throw new Error(errorMessage);
      }
      
      throw new Error(`Ցանցային սխալ: Չհաջողվեց միանալ API-ին ${url}. ${networkError.message || 'Խնդրում ենք ստուգել, արդյոք API սերվերը գործարկված է:'}`);
    }

    if (!response.ok) {
      // Retry on 429 (Too Many Requests) errors
      if (response.status === 429 && retryCount < maxRetries) {
        const delay = retryDelay * (retryCount + 1); // Exponential backoff
        console.warn(`⚠️ [API CLIENT] Rate limited, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.get<T>(endpoint, options, retryCount + 1);
      }

      let errorText = '';
      let errorData: any = null;
      const isUnauthorized = response.status === 401;
      
      // Log error only if it's not a 401 (authentication errors are expected)
      if (this.shouldLogError(response.status)) {
        console.error(`❌ [API CLIENT] GET Error: ${response.status} ${response.statusText}`, {
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
      }
      
      // Handle 401 Unauthorized - clear token and redirect
      if (isUnauthorized) {
        this.handleUnauthorized();
      }
      
      try {
        const text = await response.text();
        errorText = text || '';
        
        // Try to parse as JSON
        if (errorText && errorText.trim().startsWith('{')) {
          try {
            errorData = JSON.parse(errorText);
            // Don't log 401 errors (authentication errors are expected)
            if (!isUnauthorized) {
              console.error('❌ [API CLIENT] GET Error response (JSON):', errorData);
            }
          } catch (parseErr) {
            // If JSON parse fails, use text as is
            if (!isUnauthorized) {
              console.error('❌ [API CLIENT] GET Error response (text):', errorText);
            }
          }
        } else if (errorText && !isUnauthorized) {
          console.error('❌ [API CLIENT] GET Error response (text):', errorText);
        }
      } catch (e) {
        if (!isUnauthorized) {
          console.error('❌ [API CLIENT] Failed to read error response:', e);
        }
      }
      
      // Create a more detailed error with safe fallbacks
      const errorMessage = errorData?.detail || errorData?.message || (errorText ? String(errorText) : '') || `API Error: ${response.status} ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, response.statusText || '', errorData);
    }

    try {
      const contentType = response.headers.get('content-type');
      console.log('🌐 [API CLIENT] Response content-type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ [API CLIENT] GET Non-JSON response:', {
          contentType,
          status: response.status,
          text: text.substring(0, 200), // First 200 chars
        });
        throw new Error(`Expected JSON response but got ${contentType}. Status: ${response.status}`);
      }
      
      const jsonData = await response.json();
      console.log('✅ [API CLIENT] GET Response parsed successfully');
      return jsonData;
    } catch (parseError: any) {
      console.error('❌ [API CLIENT] GET JSON parse error:', parseError);
      if (parseError.message && parseError.message.includes('Expected JSON')) {
        throw parseError;
      }
      throw new Error(`Failed to parse response as JSON: ${parseError.message || String(parseError)}`);
    }
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    try {
      const url = this.buildUrl(endpoint, options?.params);
      
      console.log('📤 [API CLIENT] POST request:', { url, data: data ? 'provided' : 'none' });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(options),
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });

      console.log('📥 [API CLIENT] Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorText = '';
        let errorData: any = null;
        const isUnauthorized = response.status === 401;
        
        // Handle 401 Unauthorized - clear token and redirect
        if (isUnauthorized) {
          this.handleUnauthorized();
        }
        
        try {
          const text = await response.text();
          errorText = text || '';
          
          // Try to parse as JSON
          if (errorText && errorText.trim().startsWith('{')) {
            try {
              errorData = JSON.parse(errorText);
              if (this.shouldLogError(response.status)) {
                console.error('❌ [API CLIENT] POST Error response (JSON):', errorData);
              }
            } catch (parseErr) {
              // If JSON parse fails, use text as is
              if (this.shouldLogError(response.status)) {
                console.error('❌ [API CLIENT] POST Error response (text):', errorText);
              }
            }
          } else if (errorText && this.shouldLogError(response.status)) {
            console.error('❌ [API CLIENT] POST Error response (text):', errorText);
          }
        } catch (e) {
          if (this.shouldLogError(response.status)) {
            console.error('❌ [API CLIENT] Failed to read error response:', e);
          }
        }
        
        // Create a more detailed error with safe fallbacks
        const errorMessage = errorData?.detail || errorData?.message || (errorText ? String(errorText) : '') || `API Error: ${response.status} ${response.statusText}`;
        throw new ApiError(errorMessage, response.status, response.statusText || '', errorData);
      }

      try {
        const jsonData = await response.json();
        console.log('✅ [API CLIENT] Response parsed successfully');
        return jsonData;
      } catch (parseError) {
        console.error('❌ [API CLIENT] JSON parse error:', parseError);
        throw new Error(`Failed to parse response: ${parseError}`);
      }
    } catch (error: any) {
      // Handle network errors, URL construction errors, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ [API CLIENT] Network error:', error);
        throw new Error(`Network error: Unable to connect to API. Please check if the API server is running at ${this.baseUrl}`);
      }
      
      // Re-throw if it's already our custom ApiError
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Re-throw if it's a parse error
      if (error.message && error.message.includes('Failed to parse')) {
        throw error;
      }
      
      // Otherwise wrap in a generic error
      console.error('❌ [API CLIENT] POST request failed:', error);
      throw new Error(`API request failed: ${error.message || String(error)}`);
    }
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(options),
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      let errorText = '';
      let errorData: any = null;
      
      try {
        const text = await response.text();
        errorText = text || '';
        
        // Try to parse as JSON
        if (errorText && errorText.trim().startsWith('{')) {
          try {
            errorData = JSON.parse(errorText);
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] PUT Error response (JSON):', errorData);
            }
          } catch (parseErr) {
            // If JSON parse fails, use text as is
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] PUT Error response (text):', errorText);
            }
          }
        } else if (errorText && this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] PUT Error response (text):', errorText);
        }
      } catch (e) {
        if (this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] Failed to read error response:', e);
        }
      }
      
      // Create a more detailed error with safe fallbacks
      const errorMessage = errorData?.detail || errorData?.message || (errorText ? String(errorText) : '') || `API Error: ${response.status} ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, response.statusText || '', errorData);
    }

    try {
      return await response.json();
    } catch (parseError) {
      console.error('❌ [API CLIENT] PUT JSON parse error:', parseError);
      throw new Error(`Failed to parse response: ${parseError}`);
    }
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(options),
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      let errorText = '';
      let errorData: any = null;
      
      try {
        const text = await response.text();
        errorText = text || '';
        
        // Try to parse as JSON
        if (errorText && errorText.trim().startsWith('{')) {
          try {
            errorData = JSON.parse(errorText);
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] PATCH Error response (JSON):', errorData);
            }
          } catch (parseErr) {
            // If JSON parse fails, use text as is
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] PATCH Error response (text):', errorText);
            }
          }
        } else if (errorText && this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] PATCH Error response (text):', errorText);
        }
      } catch (e) {
        if (this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] Failed to read error response:', e);
        }
      }
      
      // Create a more detailed error with safe fallbacks
      const errorMessage = errorData?.detail || errorData?.message || (errorText ? String(errorText) : '') || `API Error: ${response.status} ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, response.statusText || '', errorData);
    }

    try {
      return await response.json();
    } catch (parseError) {
      console.error('❌ [API CLIENT] PATCH JSON parse error:', parseError);
      throw new Error(`Failed to parse response: ${parseError}`);
    }
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(options),
      ...options,
    });

    if (!response.ok) {
      let errorText = '';
      let errorData: any = null;
      
      try {
        const text = await response.text();
        errorText = text || '';
        
        // Try to parse as JSON
        if (errorText && errorText.trim().startsWith('{')) {
          try {
            errorData = JSON.parse(errorText);
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] DELETE Error response (JSON):', errorData);
            }
          } catch (parseErr) {
            // If JSON parse fails, use text as is
            if (this.shouldLogError(response.status)) {
              console.error('❌ [API CLIENT] DELETE Error response (text):', errorText);
            }
          }
        } else if (errorText && this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] DELETE Error response (text):', errorText);
        }
      } catch (e) {
        if (this.shouldLogError(response.status)) {
          console.error('❌ [API CLIENT] Failed to read error response:', e);
        }
      }
      
      // Create a more detailed error with safe fallbacks
      const errorMessage = errorData?.detail || errorData?.message || (errorText ? String(errorText) : '') || `API Error: ${response.status} ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, response.statusText || '', errorData);
    }

    // DELETE requests might not return a body
    try {
      const text = await response.text();
      if (text) {
        return JSON.parse(text);
      }
      return null as T;
    } catch (parseError) {
      // If there's no body or parse fails, return null for DELETE
      return null as T;
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

