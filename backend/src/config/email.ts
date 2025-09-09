import nodemailer from 'nodemailer';
import { config } from './database';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  rateLimit: number;
}

export const emailConfig: EmailConfig = {
  host: config.SMTP_HOST,
  port: parseInt(config.SMTP_PORT, 10),
  secure: config.SMTP_SECURE === 'true',
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS
  },
  from: config.SMTP_FROM,
  rateLimit: 5
};

let transporter: nodemailer.Transporter | null = null;

export function createEmailTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  try {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: emailConfig.rateLimit
    });

    return transporter;
  } catch (error) {
    console.error('メール設定の初期化に失敗しました:', error);
    throw error;
  }
}

export function getEmailConfig() {
  return emailConfig;
}
