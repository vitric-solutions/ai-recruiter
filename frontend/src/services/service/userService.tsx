import { userApi } from "../api/userApi/userApi";

class UserService {
  login(id: string, data: any) {
    return userApi.CandidateLogin(id, data);
  }

  // adhar verification
  adharVerification(id: string, data: any) {
    // //console.log("Received data for adhar verification:", data);
    const formData = new FormData();
    // backend expects field name 'aadharCard'
    formData.append("aadharCard", data);
    //  //console.log("FormData created for adhar verification:", formData);
    return userApi.AdharVerification(id, formData);
  }

  //  selfie verification
  selfieVerification(id: string, data: any) {
    // //console.log("Received data for selfie verification:", data);
    const formData = new FormData();
    // backend expects field name 'photo'
    formData.append("photo", data);
    //  //console.log("FormData created for selfie verification:", formData);
    return userApi.SelfieVerification(id, formData);
  }

  //  interview instruction
  getInterviewInstruction(id: string) {
    return userApi.InterviewInstruction(id);
  }

  //  mcq assessment
  getMCQAssessment(id: string) {
    return userApi.GetAllMcqs(id);
  }

  //  submit mcq assessment
  submitMCQAssessment(id: string, data: any) {
    return userApi.SingleSubmit(id, data);
  }

  //  final submit mcq assessment
  finalSubmitMCQAssessment(id: string, data: any) {
    return userApi.FinalSubmit(id, data);
  }
  generateMCQ(data:any,id?:string){
    return userApi.generateMCQ(data,id);
  }
  generateFeedback(data:any){
    return userApi.generateFeedback(data);
  }
}

export const userService = new UserService();
