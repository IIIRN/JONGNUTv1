import { sendAppointmentReminders } from '@/app/actions/reminderActions';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Verify the request is from a cron job (optional security measure)
    const authHeader = request.headers.get('authorization');
    
    // You can add authentication here if needed
    // For example: if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }
    
    console.log('Cron job triggered: sending appointment reminders');
    
    const result = await sendAppointmentReminders();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Appointment reminders processed successfully',
        data: result
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to process appointment reminders',
        error: result.error
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in reminder cron job:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error.message
    }, { status: 500 });
  }
}

