import { NextRequest, NextResponse } from 'next/server';
import { connectLineToCustomer } from '@/app/actions/customerActions';

/**
 * API endpoint for automatically connecting LINE ID to customer
 * This can be called when customer first interacts with LINE Bot
 */
export async function POST(request) {
  try {
    const { userId, phoneNumber, profile } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'LINE User ID is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Connect LINE ID to customer with optional profile data
    const result = await connectLineToCustomer(
      phoneNumber,
      userId,
      {
        fullName: profile?.displayName || '',
        email: profile?.email || ''
      }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        customerId: result.customerId,
        mergedPoints: result.mergedPoints,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in LINE connection API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if phone number has points that can be merged
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const { checkPhonePointsForMerge } = await import('@/app/actions/pointMergeActions');
    const result = await checkPhonePointsForMerge(phoneNumber);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error checking phone points:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

