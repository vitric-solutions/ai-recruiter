import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();


// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Format date helper
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Format time helper
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Send MCQ Interview invitation email with credentials
 * @param {string} candidateEmail - Candidate's email
 * @param {string} candidateName - Candidate's name
 * @param {string} interviewLink - Interview link
 * @param {string} username - Generated username
 * @param {string} password - Generated password
 * @param {string} testTitle - Assessment title
 * @param {string} difficulty - Difficulty level
 * @param {string} duration - Duration
 * @param {number} noOfQuestions - Number of questions
 * @param {string} passingScore - Passing score percentage
 * @param {string} primarySkill - Primary skill
 * @param {string} secondarySkill - Secondary skill (optional)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */

// Send AI Interview invitation email
export const sendMCQInterviewLink = async (
  candidateEmail,
  candidateName,
  interviewLink,
  username,
  password,
  testTitle,
  difficulty,
  duration,
  noOfQuestions,
  passingScore,
  primarySkill,
  secondarySkill,
  startDate,
  endDate
) => {
const emailHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #f3f4f6;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1f2937;
  }

  .wrapper {
    padding: 50px 0;
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #e5e7eb;
  }

  .header {
    padding: 28px 36px;
    border-bottom: 1px solid #e5e7eb;
  }

  .header h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .content {
    padding: 36px;
    font-size: 14px;
    line-height: 1.7;
  }

  .content p {
    margin: 0 0 16px 0;
  }

  .details-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    margin-bottom: 20px;
  }

  .details-table td {
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }

  .label {
    width: 40%;
    color: #6b7280;
    font-size: 13px;
  }

  .value {
    font-weight: 500;
  }

  .credentials-box {
    border: 1px solid #e5e7eb;
    background: #fafafa;
    padding: 18px;
    margin-top: 20px;
    font-size: 13px;
  }

  .credentials-box strong {
    display: block;
    margin-bottom: 10px;
    font-size: 14px;
  }

  .button-wrapper {
    text-align: start;
    margin: 35px 0;
  }

  .button {
    display: inline-block;
    padding: 12px 30px;
    background: #111827;
    color: #ffffff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.4px;
  }

  .button:hover {
    background: #000000;
  }

  .footer {
    padding: 24px 36px;
    font-size: 12px;
    color: #6b7280;
    border-top: 1px solid #e5e7eb;
    line-height: 1.6;
  }
</style>
</head>

<body>
<div class="wrapper">
  <div class="container">

    <div class="header">
      <h1>Assessment Invitation</h1>
    </div>

    <div class="content">
      <p>Dear ${candidateName},</p>

      <p>
        You have been shortlisted to participate in an online assessment as part of our recruitment process.
        Kindly review the details below carefully.
      </p>

      <table class="details-table">
        <tr>
          <td class="label">Assessment Title</td>
          <td class="value">${testTitle}</td>
        </tr>
        <tr>
          <td class="label">Primary Skill</td>
          <td class="value">${primarySkill}</td>
        </tr>
        ${
          secondarySkill
            ? `<tr>
                <td class="label">Secondary Skill</td>
                <td class="value">${secondarySkill}</td>
              </tr>`
            : ""
        }
        <tr>
          <td class="label">Difficulty Level</td>
          <td class="value">${difficulty}</td>
        </tr>
        <tr>
          <td class="label">Duration</td>
          <td class="value">${duration}</td>
        </tr>
        <tr>
          <td class="label">Number of Questions</td>
          <td class="value">${noOfQuestions}</td>
        </tr>
        <tr>
          <td class="label">Passing Criteria</td>
          <td class="value">${passingScore}%</td>
        </tr>
        <tr>
          <td class="label">Start Date</td>
          <td class="value">${formatDate(startDate)} (${formatTime(startDate)})</td>
        </tr>
        <tr>
          <td class="label">End Date</td>
          <td class="value">${formatDate(endDate)} (${formatTime(endDate)})</td>
        </tr>
      </table>

      <div class="credentials-box">
        <strong>Login Credentials</strong>
        Email: ${candidateEmail}<br/>
        Password: ${password}
      </div>

      <div class="button-wrapper">
        <a href="${interviewLink}" class="button">
          Access Assessment
        </a>
      </div>

      <p>
        Please ensure you complete the assessment within the specified time window.
        For any technical concerns, contact the recruitment team.
      </p>

      <p>
        Regards,<br/>
        Recruitment Team
      </p>
    </div>

    <div class="footer">
      This is an automated communication. Please do not reply to this email.<br/>
      © ${new Date().getFullYear()} Recruitment Department. All rights reserved.
    </div>

  </div>
</div>
</body>
</html>
`;

  const mailOptions = {
    from: `"Assessment Platform" <${process.env.EMAIL_USER}>`,
    to: candidateEmail,
    subject: `Assessment Invitation: ${testTitle}`,
    html: emailHTML,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${candidateEmail}`);
    return { success: true, email: candidateEmail };
  } catch (error) {
    console.error(`❌ Error sending email to ${candidateEmail}:`, error);
    throw error;
  }
};

// Send AI Interview invitation email
export const sendAIInterviewLink = async (
  candidateEmail,
  interviewLink,
  password,
  subjectLine,
  passingScore,
  messageBody,
  scheduledEndDate,
  scheduledStartDate
) => {
  console.log("candidateEmail:", candidateEmail);
  console.log("interviewLink:", interviewLink);
  console.log("password:", password);
  console.log("subjectLine:", subjectLine);
  console.log("passingScore:", passingScore);
  console.log("messageBody:", messageBody);
  console.log("scheduledEndDate:", scheduledEndDate);
  console.log("scheduledStartDate:", scheduledStartDate);
 const emailHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #f5f6f8;
    font-family: Arial, Helvetica, sans-serif;
    color: #2c2c2c;
  }

  .wrapper {
    padding: 40px 0;
  }

  .container {
    max-width: 620px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #e1e4e8;
  }

  .header {
    padding: 24px 32px;
    border-bottom: 1px solid #e1e4e8;
  }

  .header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }

  .content {
    padding: 32px;
    font-size: 14px;
    line-height: 1.6;
  }

  .details {
    margin: 20px 0;
  }

  .button-wrapper {
    text-align: start;
    margin: 30px 0;
  }

  .button {
    background: #1f2937;
    color: #ffffff;
    padding: 12px 28px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }

  .footer {
    padding: 20px 32px;
    font-size: 12px;
    color: #6b7280;
    border-top: 1px solid #e1e4e8;
  }
</style>
</head>

<body>
<div class="wrapper">
  <div class="container">
    
    <div class="header">
      <h1>AI Interview Invitation</h1>
    </div>

    <div class="content">
      <p>Dear Candidate,</p>

      <p>
        You are invited to complete an AI-based interview as part of our evaluation process.
      </p>

      <div class="details">
        <strong>Scheduled Window:</strong><br />
        ${formatDate(scheduledStartDate)} (${formatTime(scheduledStartDate)})<br />
        to<br />
        ${formatDate(scheduledEndDate)} (${formatTime(scheduledEndDate)})
      </div>

      <div class="details">
        <strong>Login Details:</strong><br />
        Email: ${candidateEmail}<br />
        Password: ${password}
      </div>

      <div class="button-wrapper">
        <a href="${interviewLink}" class="button">
          Start Interview
        </a>
      </div>

      <p>
        Please ensure you complete the interview before the deadline.
      </p>

      <p>
        Regards,<br />
        Recruitment Team
      </p>
    </div>

    <div class="footer">
      This email was generated automatically. Please do not reply.
      <br />
      © ${new Date().getFullYear()} Recruitment Department.
    </div>

  </div>
</div>
</body>
</html>
`;

  const mailOptions = {
    from: `"Assessment Platform" <${process.env.EMAIL_USER}>`,
    to: candidateEmail,
    subject: subjectLine,
    html: emailHTML,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ AI Interview email sent to ${candidateEmail}`);
  } catch (error) {
    console.error(`❌ Error sending AI interview email:`, error);
    throw error;
  }
};

//Send MCQ Scorecard email
export const sendMCQScorecard = async (candidateEmail, candidateName, scoreData) => {
  const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .score-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Assessment Results</h1>
        </div>
        <div class="content">
          <p>Dear ${candidateName},</p>
          <p>Your assessment has been evaluated. Here are your results:</p>
          <div class="score-box">
            <p><strong>Total Score:</strong> ${scoreData.totalScore}</p>
            <p><strong>Result:</strong> ${scoreData.result}</p>
          </div>
          <p>Thank you for participating!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Assessment Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Assessment Platform" <${process.env.EMAIL_USER}>`,
    to: candidateEmail,
    subject: "Your Assessment Results",
    html: emailHTML,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Scorecard sent to ${candidateEmail}`);
  } catch (error) {
    console.error(`❌ Error sending scorecard:`, error);
    throw error;
  }
};

 //Send AI Interview Scorecard
export const sendAIScorecard = async (candidateEmail, candidateName, scoreData) => {
  // Similar to MCQ scorecard but for AI interviews
  return sendMCQScorecard(candidateEmail, candidateName, scoreData);
};


export const sendInterviewCancellationEmail = async (
  candidateEmail,
  candidateName,
  interviewType,
  testTitle,
  scheduledStartDate,
  hrEmail
) => {

  const emailHTML = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111827;
    }

    .wrapper {
      padding: 60px 20px;
    }

    .card {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.05);
    }

    h1 {
      font-size: 22px;
      margin-bottom: 16px;
    }

    p {
      font-size: 14px;
      line-height: 1.7;
      color: #374151;
    }

    .info-box {
      margin-top: 20px;
      padding: 18px;
      background: #f9fafb;
      border-radius: 6px;
      font-size: 14px;
    }

    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
  </head>

  <body>
  <div class="wrapper">
    <div class="card">

      <h1>Interview Cancellation Notice</h1>

      <p>Dear ${candidateName},</p>

      <p>
        We would like to inform you that your scheduled ${interviewType} interview
        has been cancelled.
      </p>

      <div class="info-box">
        <strong>Interview:</strong> ${testTitle}<br/>
        <strong>Scheduled Date:</strong> ${formatDate(scheduledStartDate)} (${formatTime(scheduledStartDate)})
      </div>

      <p>
        If this cancellation was unexpected or you require further clarification,
        please contact our recruitment team.
      </p>

      <p>
        Regards,<br/>
        Recruitment Team
      </p>

      <div class="footer">
        This is an automated notification.<br/>
        © ${new Date().getFullYear()} Recruitment Department
      </div>

    </div>
  </div>
  </body>
  </html>
  `;

  // Send to Candidate
  await transporter.sendMail({
    from: `"Recruitment Team" <${process.env.EMAIL_USER}>`,
    to: candidateEmail,
    subject: `Interview Cancelled – ${testTitle}`,
    html: emailHTML,
  });

  // Send to HR
  await transporter.sendMail({
    from: `"Recruitment System" <${process.env.EMAIL_USER}>`,
    to: hrEmail,
    subject: `Candidate Interview Cancelled – ${candidateName}`,
    html: `
      <p><strong>Candidate:</strong> ${candidateName}</p>
      <p><strong>Email:</strong> ${candidateEmail}</p>
      <p><strong>Interview:</strong> ${testTitle}</p>
      <p><strong>Scheduled Date:</strong> ${formatDate(scheduledStartDate)} (${formatTime(scheduledStartDate)})</p>
      <p>Status: Cancelled</p>
    `,
  });

};