import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import CircuitBreaker = require('opossum');
import { QUEUE_NAMES } from '../queue.constants';

export interface EmailJobData {
  type: 'confirmation' | 'admin-notification';
  to?: string;
  enquiryId: string;
  name?: string;
  email?: string;
  propertyTitle?: string;
}

@Processor(QUEUE_NAMES.EMAIL)
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);
  private readonly smtpBreaker: CircuitBreaker;

  constructor() {
    super();

    this.smtpBreaker = new CircuitBreaker(this.sendEmail.bind(this), {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 5,
      rollingCountTimeout: 30000,
      name: 'smtp',
    });

    this.smtpBreaker.on('open', () => {
      this.logger.warn('SMTP circuit breaker OPENED — emails will be retried after reset');
    });

    this.smtpBreaker.on('halfOpen', () => {
      this.logger.log('SMTP circuit breaker HALF-OPEN — probing...');
    });

    this.smtpBreaker.on('close', () => {
      this.logger.log('SMTP circuit breaker CLOSED — normal operation resumed');
    });
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { type, to, enquiryId, name, email, propertyTitle } = job.data;

    // Validate required data — permanent failure if missing
    if (!type || !enquiryId) {
      throw new UnrecoverableError('Missing required job data: type and enquiryId are required');
    }

    if (type === 'confirmation' && !to) {
      throw new UnrecoverableError('Missing required field "to" for confirmation email');
    }

    if (type === 'confirmation' && to && !this.isValidEmail(to)) {
      throw new UnrecoverableError(`Invalid email format: ${to}`);
    }

    if (type === 'admin-notification' && email && !this.isValidEmail(email)) {
      throw new UnrecoverableError(`Invalid email format for admin notification: ${email}`);
    }

    // Render the email content
    const { subject, body } = this.renderTemplate(type, {
      to,
      name,
      email,
      propertyTitle,
      enquiryId,
    });

    const recipient = type === 'confirmation' ? to! : 'admin@enquiry.dev';

    try {
      await this.smtpBreaker.fire(recipient, subject, body);
      this.logger.log(`Email sent successfully: type=${type}, enquiryId=${enquiryId}`);
    } catch (error) {
      if (this.smtpBreaker.opened) {
        // Circuit is open — throw so BullMQ retries the job later
        throw new Error('SMTP circuit breaker is OPEN — job will be retried after reset timeout');
      }
      // Re-throw for BullMQ retry handling
      throw error;
    }
  }

  /**
   * The actual SMTP send function wrapped by the circuit breaker.
   * In development mode, logs the email instead of sending.
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`[DEV] Email to: ${to}\n  Subject: ${subject}\n  Body: ${body}`);
      return;
    }

    // In production, this would use nodemailer or similar SMTP transport.
    // For now, log as a placeholder for actual SMTP integration.
    this.logger.log(`[SMTP] Sending email to: ${to}, subject: ${subject}`);
    // TODO: Integrate actual SMTP transport (nodemailer) when SMTP_HOST is configured
  }

  /**
   * Render email template based on type.
   */
  private renderTemplate(
    type: EmailJobData['type'],
    context: {
      to?: string;
      name?: string;
      email?: string;
      propertyTitle?: string;
      enquiryId: string;
    },
  ): { subject: string; body: string } {
    switch (type) {
      case 'confirmation':
        return {
          subject: `Enquiry Confirmation - ${context.propertyTitle || 'Property'}`,
          body: [
            `Dear ${context.name || 'Customer'},`,
            '',
            `Thank you for your enquiry about "${context.propertyTitle || 'the property'}".`,
            `Your enquiry reference is: ${context.enquiryId}`,
            '',
            'We have received your enquiry and will be in touch shortly.',
            '',
            'Kind regards,',
            'The Property Team',
          ].join('\n'),
        };

      case 'admin-notification':
        return {
          subject: `New Enquiry Received - ${context.propertyTitle || 'Property'}`,
          body: [
            'A new property enquiry has been received:',
            '',
            `Name: ${context.name || 'N/A'}`,
            `Email: ${context.email || 'N/A'}`,
            `Property: ${context.propertyTitle || 'N/A'}`,
            `Enquiry ID: ${context.enquiryId}`,
            '',
            'Please review and respond promptly.',
          ].join('\n'),
        };

      default:
        throw new UnrecoverableError(`Unknown email template type: ${type}`);
    }
  }

  /**
   * Basic email format validation.
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
