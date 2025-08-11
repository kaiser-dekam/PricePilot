import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface InvitationEmailData {
  to: string;
  inviterName: string;
  companyName: string;
  role: string;
  invitationUrl: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  try {
    const msg = {
      to: data.to,
      from: 'noreply@yourdomain.com', // Replace with your verified SendGrid sender email
      templateId: 'd-e6ed096042054279a7b3282d95046708',
      dynamicTemplateData: {
        inviterName: data.inviterName,
        companyName: data.companyName,
        role: data.role,
        invitationUrl: data.invitationUrl,
      },
    };

    await sgMail.send(msg);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}