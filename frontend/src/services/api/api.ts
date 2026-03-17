import axios from "axios";
import type {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";


import { handleErrResult } from "../ErrHandler";
import { EventEmitter } from "../../utils/EventEmitter";
import { Base_Url } from "../../utils/constants";

interface IApi {
  _get<T = any>(url: string, config?: InternalAxiosRequestConfig): Promise<T>;
  _post<T = any>(
    url: string,
    data?: any,
    config?: InternalAxiosRequestConfig
  ): Promise<T>;
  _postFormData<T = any>(
    url: string,
    formData: FormData,
    config?: InternalAxiosRequestConfig
  ): Promise<T>;
  _putFormData<T = any>(
    url: string,
    formData: FormData,
    config?: InternalAxiosRequestConfig
  ): Promise<T>;
  _put<T = any>(url: string, data?: any): Promise<T>;
  _patch<T = any>(url: string, data?: any): Promise<T>;
  _delete<T = any>(url: string, data?: any): Promise<T>;
}

let apiCallCount = 0;

class Api implements IApi {
  private _hostName: string = `${Base_Url}`;

  private _axios: AxiosInstance = axios.create({
    baseURL: this._hostName,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  constructor() {
    this._initializeRequestInterceptor();
    this._initializeResponseInterceptor();
  }

  // =============================
  // REQUEST INTERCEPTOR
  // =============================
  private _initializeRequestInterceptor() {
    this._axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (apiCallCount === 0) {
          EventEmitter.dispatch("setLoading", true);
        }
        apiCallCount++;

        const token =
          localStorage.getItem("accessToken") ||
          sessionStorage.getItem("accessToken");

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // =============================
  // RESPONSE INTERCEPTOR
  // =============================
  private _initializeResponseInterceptor() {
    this._axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("accessToken");
          sessionStorage.removeItem("accessToken");
          window.location.href = "/admin/login";
        }
        return Promise.reject(error);
      }
    );
  }

  // =============================
  // SUCCESS HANDLER
  // =============================
  private _handleResult<T>(result: AxiosResponse<T>) {
    apiCallCount--;
    if (apiCallCount <= 0) {
      EventEmitter.dispatch("setLoading", false);
      apiCallCount = 0;
    }

    return { ...result.data, status: result.status };
  }

  // =============================
  // ERROR HANDLER
  // =============================
  private _handleError(err: AxiosError) {
    apiCallCount--;
    if (apiCallCount <= 0) {
      EventEmitter.dispatch("setLoading", false);
      apiCallCount = 0;
    }

    if (err.response) {
      handleErrResult(err);
    } else if (err.request) {
      console.error("No response received:", err.request);
    } else {
      console.error("Axios error:", err.message);
    }

    return Promise.reject(err);
  }

  // =============================
  // HTTP METHODS
  // =============================

  _get<T = any>(url: string, config?: InternalAxiosRequestConfig): Promise<T> {
    return this._axios
      .get(url, config)
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _post<T = any>(
    url: string,
    data?: any,
    config?: InternalAxiosRequestConfig
  ): Promise<T> {
    return this._axios
      .post(url, data || {}, config)
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _postFormData<T = any>(
    url: string,
    formData: FormData,
    config?: InternalAxiosRequestConfig
  ): Promise<T> {
    return this._axios
      .post(url, formData, {
        ...config,
        headers: {
          ...config?.headers,
          "Content-Type": "multipart/form-data",
        },
      })
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _putFormData<T = any>(
    url: string,
    formData: FormData,
    config?: InternalAxiosRequestConfig
  ): Promise<T> {
    return this._axios
      .put(url, formData, {
        ...config,
        headers: {
          ...config?.headers,
          "Content-Type": "multipart/form-data",
        },
      })
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _put<T = any>(url: string, data?: any): Promise<T> {
    return this._axios
      .put(url, data || {})
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _patch<T = any>(url: string, data?: any): Promise<T> {
    return this._axios
      .patch(url, data || {})
      .then(this._handleResult)
      .catch(this._handleError);
  }

  _delete<T = any>(url: string, data?: any): Promise<T> {
    return this._axios
      .delete(url, { data })
      .then(this._handleResult)
      .catch(this._handleError);
  }
}

const api = new Api();
export { api };