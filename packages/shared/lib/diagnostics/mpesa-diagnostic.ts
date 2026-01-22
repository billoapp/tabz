/**
 * M-Pesa Integration Diagnostic Service
 * Comprehensive diagnosis of M-Pesa credential decryption issues
 */

import { EnvironmentValidator, EnvironmentValidationReport } from './environment-validator';
import { createClient } from '@supabase/supabase-js';

export interface DiagnosticReport {
  timestamp: Date;
  environment: 'development' | 'production' | 'unknown';
  overallStatus: 'healthy' | 'warning' | 'critical';
  
  // Environment validation
  environmentVariables: {
    present: string[];
    missing: string[];
    invalid: string[];
    validationReport: EnvironmentValidationReport;
  };
  
  // Encryption key validation
  encryptionKey: {
    present: boolean;
    format: 'valid' | 'invalid' | 'missing';
    length: number;
    canEncryptDecrypt: boolean;
    testError?: string;
  };
  
  // Database access validation
  databaseAccess: {
    connected: boolean;
    credentialTableExists: boolean;
    credentialCount: number;
    hasActiveCredentials: boolean;
    accessError?: string;
  };
  
  // Credential format validation
  credentialFormat: {
    valid: boolean;
    issues: string[];
    encryptionMethod?: string;
    lastModified?: Date;
  };
  
  // Decryption test
  decryptionTest: {
    successful: boolean;
    error?: string;
    errorType?: 'key' | 'format' | 'algorithm' | 'database' | 'network';
    errorDetails?: any;
  };
  
  // Recommendations
  recommendations: string[];
  criticalIssues: string[];
  nextSteps: string[];
}

export interface EncryptionTestResult {
  canEncrypt: boolean;
  canDecrypt: boolean;
  roundTripSuccessful: boolean;
  error?: string;
}

export interface DatabaseAccessResult {
  connected: boolean;
  credentialTableExists: boolean;
  credentialCount: number;
  hasActiveCredentials: boolean;
  sampleCredentialId?: string;
  error?: string;
}

/**
 * M-Pesa Diagnostic Service
 */
export class MpesaDiagnosticService {
  private environmentValidator: EnvironmentValidator;
  
  constructor() {
    this.environmentValidator = new EnvironmentValidator();
  }
  
  /**
   * Run comprehensive M-Pesa diagnostic
   */
  async runFullDiagnostic(barId?: string): Promise<DiagnosticReport> {
    console.log('🔍 Starting M-Pesa diagnostic...');
    
    const report: DiagnosticReport = {
      timestamp: new Date(),
      environment: this.detectEnvironment(),
      overallStatus: 'healthy',
      environmentVariables: {
        present: [],
        missing: [],
        invalid: [],
        validationReport: {} as EnvironmentValidationReport
      },
      encryptionKey: {
        present: false,
        format: 'missing',
        length: 0,
        canEncryptDecrypt: false
      },
      databaseAccess: {
        connected: false,
        credentialTableExists: false,
        credentialCount: 0,
        hasActiveCredentials: false
      },
      credentialFormat: {
        valid: false,
        issues: []
      },
      decryptionTest: {
        successful: false
      },
      recommendations: [],
      criticalIssues: [],
      nextSteps: []
    };
    
    try {
      // 1. Validate environment variables
      console.log('📋 Validating environment variables...');
      const envValidation = this.environmentValidator.validateRequiredVariables();
      report.environmentVariables = {
        present: envValidation.results.filter(r => r.present).map(r => r.variable),
        missing: envValidation.missing,
        invalid: envValidation.invalid,
        validationReport: envValidation
      };
      
      // 2. Test encryption key
      console.log('🔑 Testing encryption key...');
      const encryptionTest = await this.testEncryptionKey();
      report.encryptionKey = {
        present: !!process.env.MPESA_KMS_KEY,
        format: this.validateEncryptionKeyFormat(),
        length: process.env.MPESA_KMS_KEY?.length || 0,
        canEncryptDecrypt: encryptionTest.roundTripSuccessful,
        testError: encryptionTest.error
      };
      
      // 3. Test database access
      console.log('🗄️ Testing database access...');
      const dbTest = await this.testDatabaseAccess(barId);
      report.databaseAccess = dbTest;
      
      // 4. Test credential format (if we have database access)
      if (dbTest.connected && dbTest.sampleCredentialId) {
        console.log('📄 Testing credential format...');
        const formatTest = await this.testCredentialFormat(dbTest.sampleCredentialId);
        report.credentialFormat = formatTest;
      }
      
      // 5. Test full decryption (if everything else looks good)
      if (report.encryptionKey.canEncryptDecrypt && report.databaseAccess.connected) {
        console.log('🔓 Testing credential decryption...');
        const decryptionTest = await this.testCredentialDecryption(barId);
        report.decryptionTest = decryptionTest;
      }
      
      // 6. Generate recommendations and determine overall status
      this.generateRecommendations(report);
      
      console.log('✅ Diagnostic complete');
      return report;
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      report.overallStatus = 'critical';
      report.criticalIssues.push(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      report.nextSteps.push('Check application logs for detailed error information');
      return report;
    }
  }
  
  /**
   * Test encryption key functionality
   */
  async testEncryptionKey(): Promise<EncryptionTestResult> {
    try {
      const key = process.env.MPESA_KMS_KEY;
      
      if (!key) {
        return {
          canEncrypt: false,
          canDecrypt: false,
          roundTripSuccessful: false,
          error: 'MPESA_KMS_KEY environment variable not found'
        };
      }
      
      // Import encryption functions dynamically to avoid issues if they fail
      const { encryptCredential, decryptCredential } = await import('../mpesa/services/encryption');
      
      // Test with sample data
      const testData = 'test-credential-data-12345';
      
      // Test encryption
      const encrypted = encryptCredential(testData);
      
      // Test decryption
      const decrypted = decryptCredential(encrypted);
      
      const roundTripSuccessful = decrypted === testData;
      
      return {
        canEncrypt: true,
        canDecrypt: true,
        roundTripSuccessful,
        error: roundTripSuccessful ? undefined : 'Round-trip test failed: decrypted data does not match original'
      };
      
    } catch (error) {
      return {
        canEncrypt: false,
        canDecrypt: false,
        roundTripSuccessful: false,
        error: error instanceof Error ? error.message : 'Unknown encryption test error'
      };
    }
  }
  
  /**
   * Test database access and credential table
   */
  async testDatabaseAccess(barId?: string): Promise<DatabaseAccessResult> {
    try {
      // Create Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return {
          connected: false,
          credentialTableExists: false,
          credentialCount: 0,
          hasActiveCredentials: false,
          error: 'Supabase configuration missing'
        };
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      // Test basic connection
      const { data: connectionTest, error: connectionError } = await supabase
        .from('mpesa_credentials')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        return {
          connected: false,
          credentialTableExists: false,
          credentialCount: 0,
          hasActiveCredentials: false,
          error: `Database connection failed: ${connectionError.message}`
        };
      }
      
      // Count total credentials
      const { count: totalCount, error: countError } = await supabase
        .from('mpesa_credentials')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        return {
          connected: true,
          credentialTableExists: false,
          credentialCount: 0,
          hasActiveCredentials: false,
          error: `Failed to count credentials: ${countError.message}`
        };
      }
      
      // Check for active credentials
      let activeQuery = supabase
        .from('mpesa_credentials')
        .select('id, tenant_id, is_active')
        .eq('is_active', true);
      
      if (barId) {
        activeQuery = activeQuery.eq('tenant_id', barId);
      }
      
      const { data: activeCredentials, error: activeError } = await activeQuery.limit(1);
      
      if (activeError) {
        return {
          connected: true,
          credentialTableExists: true,
          credentialCount: totalCount || 0,
          hasActiveCredentials: false,
          error: `Failed to check active credentials: ${activeError.message}`
        };
      }
      
      return {
        connected: true,
        credentialTableExists: true,
        credentialCount: totalCount || 0,
        hasActiveCredentials: (activeCredentials?.length || 0) > 0,
        sampleCredentialId: activeCredentials?.[0]?.id
      };
      
    } catch (error) {
      return {
        connected: false,
        credentialTableExists: false,
        credentialCount: 0,
        hasActiveCredentials: false,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }
  
  /**
   * Test credential format and integrity
   */
  async testCredentialFormat(credentialId: string): Promise<{
    valid: boolean;
    issues: string[];
    encryptionMethod?: string;
    lastModified?: Date;
  }> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return {
          valid: false,
          issues: ['Supabase configuration missing']
        };
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: credential, error } = await supabase
        .from('mpesa_credentials')
        .select('*')
        .eq('id', credentialId)
        .single();
      
      if (error || !credential) {
        return {
          valid: false,
          issues: [`Failed to fetch credential: ${error?.message || 'Not found'}`]
        };
      }
      
      const issues: string[] = [];
      
      // Check required encrypted fields
      if (!credential.consumer_key_enc) {
        issues.push('Missing encrypted consumer key');
      }
      
      if (!credential.consumer_secret_enc) {
        issues.push('Missing encrypted consumer secret');
      }
      
      if (!credential.passkey_enc) {
        issues.push('Missing encrypted passkey');
      }
      
      // Check field formats (should be Buffer/bytea)
      if (credential.consumer_key_enc && credential.consumer_key_enc.length < 28) {
        issues.push('Consumer key encryption data too short (minimum 28 bytes for AES-256-GCM)');
      }
      
      if (credential.consumer_secret_enc && credential.consumer_secret_enc.length < 28) {
        issues.push('Consumer secret encryption data too short');
      }
      
      if (credential.passkey_enc && credential.passkey_enc.length < 28) {
        issues.push('Passkey encryption data too short');
      }
      
      return {
        valid: issues.length === 0,
        issues,
        encryptionMethod: 'AES-256-GCM',
        lastModified: credential.updated_at ? new Date(credential.updated_at) : undefined
      };
      
    } catch (error) {
      return {
        valid: false,
        issues: [`Credential format test failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Test full credential decryption
   */
  async testCredentialDecryption(barId?: string): Promise<{
    successful: boolean;
    error?: string;
    errorType?: 'key' | 'format' | 'algorithm' | 'database' | 'network';
    errorDetails?: any;
  }> {
    try {
      // This mimics the actual decryption process from the M-Pesa test endpoint
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return {
          successful: false,
          error: 'Supabase configuration missing',
          errorType: 'database'
        };
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Get credentials (same query as the test endpoint)
      let query = supabase
        .from('mpesa_credentials')
        .select(`
          id,
          environment,
          business_shortcode,
          consumer_key_enc,
          consumer_secret_enc,
          passkey_enc,
          is_active
        `)
        .eq('is_active', true);
      
      if (barId) {
        query = query.eq('tenant_id', barId);
      }
      
      const { data: credData, error: credError } = await query.single();
      
      if (credError || !credData) {
        return {
          successful: false,
          error: `No active credentials found: ${credError?.message || 'Not found'}`,
          errorType: 'database'
        };
      }
      
      // Import decryption function
      const { decryptCredential } = await import('../mpesa/services/encryption');
      
      // Test decryption of each field
      try {
        const consumerKeyBuffer = Buffer.isBuffer(credData.consumer_key_enc) 
          ? credData.consumer_key_enc 
          : Buffer.from(credData.consumer_key_enc);
        const consumerKey = decryptCredential(consumerKeyBuffer);
        
        const consumerSecretBuffer = Buffer.isBuffer(credData.consumer_secret_enc) 
          ? credData.consumer_secret_enc 
          : Buffer.from(credData.consumer_secret_enc);
        const consumerSecret = decryptCredential(consumerSecretBuffer);
        
        const passkeyBuffer = Buffer.isBuffer(credData.passkey_enc) 
          ? credData.passkey_enc 
          : Buffer.from(credData.passkey_enc);
        const passkey = decryptCredential(passkeyBuffer);
        
        // Validate decrypted data is reasonable
        if (!consumerKey || consumerKey.length < 10) {
          return {
            successful: false,
            error: 'Decrypted consumer key is invalid or too short',
            errorType: 'format'
          };
        }
        
        if (!consumerSecret || consumerSecret.length < 10) {
          return {
            successful: false,
            error: 'Decrypted consumer secret is invalid or too short',
            errorType: 'format'
          };
        }
        
        if (!passkey || passkey.length < 10) {
          return {
            successful: false,
            error: 'Decrypted passkey is invalid or too short',
            errorType: 'format'
          };
        }
        
        return {
          successful: true
        };
        
      } catch (decryptError) {
        return {
          successful: false,
          error: `Decryption failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`,
          errorType: 'key',
          errorDetails: decryptError
        };
      }
      
    } catch (error) {
      return {
        successful: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'algorithm',
        errorDetails: error
      };
    }
  }
  
  /**
   * Validate encryption key format
   */
  private validateEncryptionKeyFormat(): 'valid' | 'invalid' | 'missing' {
    const key = process.env.MPESA_KMS_KEY;
    
    if (!key) {
      return 'missing';
    }
    
    const validation = this.environmentValidator.validateEncryptionKeyFormat(key);
    return validation.valid ? 'valid' : 'invalid';
  }
  
  /**
   * Detect current environment
   */
  private detectEnvironment(): 'development' | 'production' | 'unknown' {
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;
    
    if (vercelEnv === 'production' || nodeEnv === 'production') {
      return 'production';
    }
    
    if (vercelEnv === 'development' || nodeEnv === 'development') {
      return 'development';
    }
    
    return 'unknown';
  }
  
  /**
   * Generate recommendations based on diagnostic results
   */
  private generateRecommendations(report: DiagnosticReport): void {
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    const nextSteps: string[] = [];
    
    // Environment variable issues
    if (report.environmentVariables.missing.length > 0) {
      criticalIssues.push(`Missing required environment variables: ${report.environmentVariables.missing.join(', ')}`);
      nextSteps.push('Add missing environment variables to your deployment configuration');
    }
    
    if (report.environmentVariables.invalid.length > 0) {
      criticalIssues.push(`Invalid environment variables: ${report.environmentVariables.invalid.join(', ')}`);
      nextSteps.push('Fix invalid environment variable formats');
    }
    
    // Encryption key issues
    if (!report.encryptionKey.present) {
      criticalIssues.push('MPESA_KMS_KEY environment variable is missing');
      nextSteps.push('Generate and set a 32-character hex encryption key');
    } else if (report.encryptionKey.format === 'invalid') {
      criticalIssues.push('MPESA_KMS_KEY format is invalid');
      nextSteps.push('Ensure encryption key is exactly 32 lowercase hex characters');
    } else if (!report.encryptionKey.canEncryptDecrypt) {
      criticalIssues.push('Encryption key cannot encrypt/decrypt data');
      nextSteps.push('Verify encryption key is correct and encryption library is working');
    }
    
    // Database issues
    if (!report.databaseAccess.connected) {
      criticalIssues.push('Cannot connect to database');
      nextSteps.push('Check Supabase configuration and network connectivity');
    } else if (!report.databaseAccess.credentialTableExists) {
      criticalIssues.push('M-Pesa credentials table does not exist');
      nextSteps.push('Run database migrations to create mpesa_credentials table');
    } else if (!report.databaseAccess.hasActiveCredentials) {
      recommendations.push('No active M-Pesa credentials found');
      nextSteps.push('Configure M-Pesa credentials through the admin interface');
    }
    
    // Credential format issues
    if (report.credentialFormat.issues.length > 0) {
      criticalIssues.push('Credential format issues detected');
      nextSteps.push('Re-encrypt and save M-Pesa credentials');
    }
    
    // Decryption issues
    if (!report.decryptionTest.successful && report.decryptionTest.error) {
      criticalIssues.push(`Credential decryption failed: ${report.decryptionTest.error}`);
      
      switch (report.decryptionTest.errorType) {
        case 'key':
          nextSteps.push('Verify encryption key matches the key used to encrypt credentials');
          break;
        case 'format':
          nextSteps.push('Re-encrypt credentials with current encryption key');
          break;
        case 'database':
          nextSteps.push('Check database connectivity and credential table structure');
          break;
        default:
          nextSteps.push('Check application logs for detailed error information');
      }
    }
    
    // Determine overall status
    if (criticalIssues.length > 0) {
      report.overallStatus = 'critical';
    } else if (recommendations.length > 0) {
      report.overallStatus = 'warning';
    } else {
      report.overallStatus = 'healthy';
      recommendations.push('M-Pesa integration appears to be configured correctly');
    }
    
    report.recommendations = recommendations;
    report.criticalIssues = criticalIssues;
    report.nextSteps = nextSteps;
  }
}

/**
 * Default diagnostic service instance
 */
export const mpesaDiagnosticService = new MpesaDiagnosticService();