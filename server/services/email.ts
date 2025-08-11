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
      from: 'noreply@catalogpilot.com', // This should be changed to your verified sender domain
      subject: `You've been invited to join ${data.companyName} on Catalog Pilot`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Catalog Pilot</h1>
            <h2 style="color: #374151; margin-bottom: 30px;">You've been invited to join ${data.companyName}</h2>
            
            <div style="background-color: white; padding: 25px; border-radius: 6px; margin: 20px 0;">
              <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                <strong>${data.inviterName}</strong> has invited you to join <strong>${data.companyName}</strong> 
                as a <strong>${data.role}</strong> on Catalog Pilot.
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
                Catalog Pilot is a powerful BigCommerce product management platform that helps teams 
                collaborate on product catalogs, manage pricing, and execute bulk updates efficiently.
              </p>
              
              <div style="margin: 30px 0;">
                <a href="${data.invitationUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 6px; font-weight: 600; 
                          display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
                This invitation will expire in 7 days. If you can't click the button above, 
                copy and paste this link into your browser:<br>
                <span style="word-break: break-all;">${data.invitationUrl}</span>
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
You've been invited to join ${data.companyName} on Catalog Pilot

${data.inviterName} has invited you to join ${data.companyName} as a ${data.role}.

Catalog Pilot is a powerful BigCommerce product management platform that helps teams collaborate on product catalogs, manage pricing, and execute bulk updates efficiently.

To accept this invitation, visit: ${data.invitationUrl}

This invitation will expire in 7 days.

If you weren't expecting this invitation, you can safely ignore this email.
      `
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}