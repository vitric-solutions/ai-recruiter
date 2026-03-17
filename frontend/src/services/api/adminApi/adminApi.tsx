// import { data } from "react-router-dom";
import { api } from "../api";

class AdminApi {
  private _url = {
    LOGIN: "/admin/login",
    ADD_CANDIDATE: "admin/create/candidate",
    BULK_ADD_CANDIDATE: "/admin/candidates/bulk",
    CREATE_ASESMENT_TEMPLATE: "/admin/assessment/template",
    UPDATE_ASESMENT_TEMPLATE: "/admin/assessment/template",
    GET_ASSESMENTS: "/admin/assessment/mcq/list",
    GET_CANDIDATES: "/admin/candidates",
    GET_CANDIDATES_BY_FILTER: "/admin/candidates/filter",
    GET_CANDIDATE_PROFILE: "/admin/candidate_profile",
    SEND_INVITES: "/admin/assessment/:assessmentId/invite",
    GENERATE_AND_INVITE: "/admin/assessment/send-invites",
    CREATE_AI_TEMPLATE: "/admin/interview/template",
    UPDATE_AI_TEMPLATE: "/admin/interview/template",
    SEND_AI_INVITES: "/admin/interview/send-invites",
    GET_AI: "/admin/interviews/list",
    UPDATE_CANDIDATE: "/admin/candidate",
    GET_ME: "/admin/me",
    UPLOAD_JD: "/admin/analyze",
    UPLOAD_RESUME: "/admin/resume/analyze",
    GENERATE_MCQ: "/admin/generate-mcq",
    TOTAL_SCHEDULE: "/admin/total-schedule",
    RE_SCHEDULE: "/admin/interview",
    CANCLE_INTERVIEW: "/admin/interview",
    TOP_PERFORMANCE: "/admin/top-performance",
    TOP_AI_PERFORMANCE: "/admin/top-ai-performance",
    SCORES: "/admin/student-scores",
  };

  login = (data: any) => {
    return api._post(this._url.LOGIN, data);
  };

  // bulk add candidate
  bulk_add_candidate(data: any) {
    return api._postFormData(this._url.BULK_ADD_CANDIDATE, data);
  }

  //create assessment template
  createAssessmentTemplate(data: any) {
    return api._postFormData(this._url.CREATE_ASESMENT_TEMPLATE, data);
  }
  updateAssessmentTemplate(id: string, data: any) {
    return api._putFormData(
      `${this._url.UPDATE_ASESMENT_TEMPLATE}/${id}/update`,
      data,
    );
  }

  getAssesments(id?: string) {
    if (id) {
      return api._get(`${this._url.GET_ASSESMENTS}/?id=${id}`);
    }
    return api._get(this._url.GET_ASSESMENTS);
  }

  // create candiate
  addCandidate(data: any) {
    return api._post(this._url.ADD_CANDIDATE, data);
  }

  //get all candidates
  getAllCandidate(page = 1, limit = 10, status = "All") {
    return api._get(
      `${this._url.GET_CANDIDATES}?page=${page}&limit=${limit}&status=${status}`,
    );
  }

  getFilteredCandidates(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return api._get(`${this._url.GET_CANDIDATES_BY_FILTER}?${query}`);
  }

  getCandidateProfile(id: string) {
    return api._get(`${this._url.GET_CANDIDATE_PROFILE}/${id}`);
  }
  // update Candidate
  updateCandidate(id: string, data: any) {
    return api._patch(`${this._url.UPDATE_CANDIDATE}/${id}`, data);
  }

  //send invites
  sendInvites(assessmentId: any, data: any) {
    const url = this._url.SEND_INVITES.replace(":assessmentId", assessmentId);
    return api._post(url, data);
  }

  //Ggenerate and invite candidates
  generateAndInvite(data: any) {
    return api._post(this._url.GENERATE_AND_INVITE, data);
  }
  updateAITemplate(id: string, data: any) {
    return api._put(`${this._url.UPDATE_AI_TEMPLATE}/${id}/update`, data);
  }

  getDraft(id?: string) {
    if (id) {
      return api._get(`${this._url.GET_AI}/?id=${id}`);
    }
    return api._get(this._url.GET_AI);
  }

  generateAIInterview(data: any) {
    return api._postFormData(this._url.CREATE_AI_TEMPLATE, data);
  }

  sendInvitations(data: any) {
    return api._post(this._url.SEND_AI_INVITES, data);
  }
  getMe() {
    return api._get(this._url.GET_ME);
  }

  analyzeJD(data: any) {
    return api._postFormData(this._url.UPLOAD_JD, data);
  }
  analyzeResume(data: any) {
    return api._postFormData(this._url.UPLOAD_RESUME, data);
  }
  generateMCQ(data: any, id?: string) {
    return api._post(`${this._url.GENERATE_MCQ}/${id}`, data);
  }

  //get total schedule
  getTotalSchedule() {
    return api._get(this._url.TOTAL_SCHEDULE);
  }

  getTopPerformance(examType: string) {
    return api._get(`${this._url.TOP_PERFORMANCE}?examType=${examType}`);
  }

  getScore(examType: string) {
    return api._get(`${this._url.SCORES}?examType=${examType}`);
  }

  // get top AI performance
  getTopAIPerformance() {
    return api._get(`${this._url.TOP_AI_PERFORMANCE}`);
  }

  reScheduleInterview(type: string, interviewId: string, data: any) {
    return api._put(
      `${this._url.RE_SCHEDULE}/${type}/${interviewId}/reschedule`,
      data,
    );
  }
  cancleInterview(type: string, interviewId: string, data: any) {
    return api._put(
      `${this._url.CANCLE_INTERVIEW}/${type}/${interviewId}/cancel`,
      data,
    );
  }
}

export const adminApi = new AdminApi();
