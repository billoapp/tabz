/**
 * M-Pesa Diagnostic API Endpoint
 * Provides comprehensive diagnostic information for M-Pesa integration issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MpesaDiagnosticService } from '@tabeza/shared/lib/diagnostics/mpesa-diagnostic';

// Create server-side client with proper authentication handling
function createServerClient(request: NextRequest) {
  // Try to get auth token from Authorization header first
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.replace('Bearer ', '');
  
  if (accessToken) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
  }
  
  // Fallback to cookie-based auth
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          cookie: request.headers.get('cookie') || ''
        }
      }
    }
  );
}

export async function POST(request: NextRequest) {
  console.log('🔍 M-Pesa diagnostic API called');
  
  try {
    const body = await request.json().catch(() => ({}));
    const { barId, includeCredentialTest = true } = body;

    // Create diagnostic service
    const diagnosticService = new MpesaDiagnosticService();
    
    // For now, allow diagnostic without authentication for debugging
    // In production, you might want to add authentication
    console.log('⚠️ Running diagnostic without authentication (for debugging)');
    
    // Run comprehensive diagnostic
    console.log('🔍 Running comprehensive M-Pesa diagnostic...');
    const report = await diagnosticService.runFullDiagnostic(barId);
    
    // Log summary for debugging
    console.log('📊 Diagnostic Summary:', {
      overallStatus: report.overallStatus,
      environment: report.environment,
      missingVars: report.environmentVariables.missing,
      invalidVars: report.environmentVariables.invalid,
      encryptionKeyPresent: report.encryptionKey.present,
      encryptionKeyFormat: report.encryptionKey.format,
      databaseConnected: report.databaseAccess.connected,
      credentialTableExists: report.databaseAccess.credentialTableExists,
      hasActiveCredentials: report.databaseAccess.hasActiveCredentials,
      decryptionSuccessful: report.decryptionTest.successful,
      criticalIssues: report.criticalIssues.length,
      recommendations: report.recommendations.length
    });
    
    // Return diagnostic report
    return NextResponse.json({
      success: true,
      report,
      summary: {
        status: report.overallStatus,
        environment: report.environment,
        criticalIssues: report.criticalIssues.length,
        recommendations: report.recommendations.length,
        canDecryptCredentials: report.decryptionTest.successful
      }
    });

  } catch (error) {
    console.error('❌ Diagnostic API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      report: {
        timestamp: new Date(),
        environment: 'unknown',
        overallStatus: 'critical',
        criticalIssues: [`Diagnostic system failure: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Check application logs for detailed error information'],
        nextSteps: ['Ensure all required dependencies are installed and configured']
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Allow GET requests for quick health checks
  const url = new URL(request.url);
  const barId = url.searchParams.get('barId');
  
  try {
    const diagnosticService = new MpesaDiagnosticService();
    const report = await diagnosticService.runFullDiagnostic(barId || undefined);
    
    return NextResponse.json({
      success: true,
      status: report.overallStatus,
      environment: report.environment,
      summary: {
        environmentVariables: {
          missing: report.environmentVariables.missing.length,
          invalid: report.environmentVariables.invalid.length
        },
        encryptionKey: {
          present: report.encryptionKey.present,
          valid: report.encryptionKey.format === 'valid'
        },
        database: {
          connected: report.databaseAccess.connected,
          hasCredentials: report.databaseAccess.hasActiveCredentials
        },
        decryption: {
          successful: report.decryptionTest.successful
        }
      },
      criticalIssues: report.criticalIssues,
      nextSteps: report.nextSteps.slice(0, 3) // Limit to top 3 next steps
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'critical',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}