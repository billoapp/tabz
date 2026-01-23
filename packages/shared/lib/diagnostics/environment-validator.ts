/**
 * Environment Variable Validator for M-Pesa Integration
 * Validates all required environment variables for credential decryption
 */

export interface EnvironmentVariable {
  name: string;
  required: boolean;
  description: string;
  format?: RegExp;
  minLength?: number;
  maxLength?: number;
  sensitive?: boolean;
}

export interface EnvironmentValidationResult {
  variable: string;
  present: boolean;
  valid: boolean;
  value?: string;
  maskedValue?: string;
  errors: string[];
}

export interface EnvironmentValidationReport {
  environment: 'development' | 'production' | 'unknown';
  timestamp: Date;
  allValid: boolean;
  results: EnvironmentValidationResult[];
  missing: string[];
  invalid: string[];
  recommendations: string[];
}

export interface EnvironmentComparison {
  variable: string;
  devValue?: string;
  prodValue?: string;
  devMasked?: string;
  prodMasked?: string;
  match: boolean;
  issue?: string;
}

/**
 * Required environment variables for M-Pesa integration
 */
export const REQUIRED_ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  // Supabase Configuration
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    format: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    minLength: 20,
    sensitive: false
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    required: true,
    description: 'Supabase publishable (anon) key',
    format: /^sb_publishable_[A-Za-z0-9_]+$/,
    minLength: 20,
    sensitive: false
  },
  {
    name: 'SUPABASE_SECRET_KEY',
    required: true,
    description: 'Supabase service role key for backend operations',
    format: /^sb_secret_[A-Za-z0-9_]+$/,
    minLength: 20,
    sensitive: true
  },
  
  // M-Pesa Configuration
  {
    name: 'MPESA_CONSUMER_KEY',
    required: true,
    description: 'M-Pesa API consumer key for authentication',
    minLength: 10,
    sensitive: true
  },
  {
    name: 'MPESA_CONSUMER_SECRET',
    required: true,
    description: 'M-Pesa API consumer secret for authentication',
    minLength: 10,
    sensitive: true
  },
  {
    name: 'MPESA_BUSINESS_SHORTCODE',
    required: true,
    description: 'M-Pesa business shortcode (paybill number)',
    format: /^\d{5,7}$/,
    minLength: 5,
    maxLength: 7,
    sensitive: false
  },
  {
    name: 'MPESA_PASSKEY',
    required: true,
    description: 'M-Pesa passkey for STK push authentication',
    minLength: 20,
    sensitive: true
  },
  {
    name: 'MPESA_ENVIRONMENT',
    required: true,
    description: 'M-Pesa environment (sandbox or production)',
    format: /^(sandbox|production)$/,
    sensitive: false
  },
  {
    name: 'MPESA_CALLBACK_URL',
    required: true,
    description: 'M-Pesa callback URL for payment notifications',
    format: /^https:\/\/.+\/api\/payments\/mpesa\/callback$/,
    minLength: 20,
    sensitive: false
  },
  
  // M-Pesa Encryption
  {
    name: 'MPESA_KMS_KEY',
    required: true,
    description: 'Master encryption key for M-Pesa credentials (32 bytes)',
    format: /^[a-f0-9]{32}$/,
    minLength: 32,
    maxLength: 32,
    sensitive: true
  },
  
  // App Configuration
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public app URL for callback generation',
    format: /^https:\/\/.+$/,
    minLength: 10,
    sensitive: false
  },
  
  // Node Environment
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Node.js environment (development, production, test)',
    format: /^(development|production|test)$/,
    sensitive: false
  },
  
  // Optional but recommended
  {
    name: 'VERCEL_ENV',
    required: false,
    description: 'Vercel environment (development, preview, production)',
    format: /^(development|preview|production)$/,
    sensitive: false
  },
  
  // Optional M-Pesa debugging
  {
    name: 'MPESA_DEBUG_MODE',
    required: false,
    description: 'Enable M-Pesa debug logging (true/false)',
    format: /^(true|false)$/,
    sensitive: false
  }
];

/**
 * Environment Variable Validator Service
 */
export class EnvironmentValidator {
  private variables: EnvironmentVariable[];
  
  constructor(customVariables?: EnvironmentVariable[]) {
    this.variables = customVariables || REQUIRED_ENVIRONMENT_VARIABLES;
  }
  
  /**
   * Validate all required environment variables
   */
  validateRequiredVariables(): EnvironmentValidationReport {
    const results: EnvironmentValidationResult[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];
    const recommendations: string[] = [];
    
    for (const variable of this.variables) {
      const result = this.validateSingleVariable(variable);
      results.push(result);
      
      if (!result.present && variable.required) {
        missing.push(variable.name);
      }
      
      if (result.present && !result.valid) {
        invalid.push(variable.name);
      }
    }
    
    // Generate recommendations
    if (missing.length > 0) {
      recommendations.push(`Add missing environment variables: ${missing.join(', ')}`);
    }
    
    if (invalid.length > 0) {
      recommendations.push(`Fix invalid environment variables: ${invalid.join(', ')}`);
    }
    
    // Check for M-Pesa specific issues
    const mpesaKey = results.find(r => r.variable === 'MPESA_KMS_KEY');
    if (mpesaKey && !mpesaKey.present) {
      recommendations.push('M-Pesa encryption key is missing - this will cause credential decryption failures');
    }
    
    const supabaseUrl = results.find(r => r.variable === 'NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = results.find(r => r.variable === 'SUPABASE_SECRET_KEY');
    if (!supabaseUrl?.present || !supabaseKey?.present) {
      recommendations.push('Supabase configuration is incomplete - database access will fail');
    }
    
    return {
      environment: this.detectEnvironment(),
      timestamp: new Date(),
      allValid: missing.length === 0 && invalid.length === 0,
      results,
      missing,
      invalid,
      recommendations
    };
  }
  
  /**
   * Validate a single environment variable
   */
  private validateSingleVariable(variable: EnvironmentVariable): EnvironmentValidationResult {
    const value = process.env[variable.name];
    const present = value !== undefined && value !== '';
    const errors: string[] = [];
    
    if (!present) {
      if (variable.required) {
        errors.push(`${variable.name} is required but not set`);
      }
      return {
        variable: variable.name,
        present: false,
        valid: !variable.required,
        errors
      };
    }
    
    // Validate format
    if (variable.format && !variable.format.test(value)) {
      errors.push(`${variable.name} format is invalid`);
    }
    
    // Validate length
    if (variable.minLength && value.length < variable.minLength) {
      errors.push(`${variable.name} is too short (minimum ${variable.minLength} characters)`);
    }
    
    if (variable.maxLength && value.length > variable.maxLength) {
      errors.push(`${variable.name} is too long (maximum ${variable.maxLength} characters)`);
    }
    
    // Create masked value for sensitive variables
    const maskedValue = variable.sensitive 
      ? this.maskSensitiveValue(value)
      : value;
    
    return {
      variable: variable.name,
      present: true,
      valid: errors.length === 0,
      value: variable.sensitive ? undefined : value,
      maskedValue,
      errors
    };
  }
  
  /**
   * Compare environment configurations between two environments
   */
  compareEnvironments(
    devEnv: Record<string, string>, 
    prodEnv: Record<string, string>
  ): EnvironmentComparison[] {
    const comparisons: EnvironmentComparison[] = [];
    
    for (const variable of this.variables) {
      const devValue = devEnv[variable.name];
      const prodValue = prodEnv[variable.name];
      
      const devMasked = devValue && variable.sensitive 
        ? this.maskSensitiveValue(devValue) 
        : devValue;
      const prodMasked = prodValue && variable.sensitive 
        ? this.maskSensitiveValue(prodValue) 
        : prodValue;
      
      let match = devValue === prodValue;
      let issue: string | undefined;
      
      if (!devValue && !prodValue) {
        match = true;
      } else if (!devValue && prodValue) {
        match = false;
        issue = 'Missing in development';
      } else if (devValue && !prodValue) {
        match = false;
        issue = 'Missing in production';
      } else if (devValue !== prodValue) {
        match = false;
        issue = 'Values differ between environments';
      }
      
      comparisons.push({
        variable: variable.name,
        devValue: variable.sensitive ? undefined : devValue,
        prodValue: variable.sensitive ? undefined : prodValue,
        devMasked,
        prodMasked,
        match,
        issue
      });
    }
    
    return comparisons;
  }
  
  /**
   * Generate environment setup checklist
   */
  generateEnvironmentChecklist(): {
    variable: string;
    description: string;
    required: boolean;
    example?: string;
    instructions: string;
  }[] {
    return this.variables.map(variable => ({
      variable: variable.name,
      description: variable.description,
      required: variable.required,
      example: this.getExampleValue(variable),
      instructions: this.getSetupInstructions(variable)
    }));
  }
  
  /**
   * Validate encryption key format specifically
   */
  validateEncryptionKeyFormat(key: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!key) {
      errors.push('Encryption key is required');
      return { valid: false, errors };
    }
    
    if (key.length !== 32) {
      errors.push(`Encryption key must be exactly 32 characters (got ${key.length})`);
    }
    
    if (!/^[a-f0-9]+$/.test(key)) {
      errors.push('Encryption key must contain only lowercase hexadecimal characters (a-f, 0-9)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
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
   * Mask sensitive values for logging
   */
  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const middle = '*'.repeat(value.length - 8);
    
    return `${start}${middle}${end}`;
  }
  
  /**
   * Get example value for a variable (for documentation)
   */
  private getExampleValue(variable: EnvironmentVariable): string | undefined {
    switch (variable.name) {
      case 'NEXT_PUBLIC_SUPABASE_URL':
        return 'https://your-project.supabase.co';
      case 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':
        return 'sb_publishable_xxxxxxxxxxxxxxxx';
      case 'SUPABASE_SECRET_KEY':
        return 'sb_secret_xxxxxxxxxxxxxxxx';
      case 'MPESA_KMS_KEY':
        return 'f37bac6fd61edf41bd1cb49a2fb79d33';
      case 'NODE_ENV':
        return 'production';
      case 'VERCEL_ENV':
        return 'production';
      default:
        return undefined;
    }
  }
  
  /**
   * Get setup instructions for a variable
   */
  private getSetupInstructions(variable: EnvironmentVariable): string {
    switch (variable.name) {
      case 'NEXT_PUBLIC_SUPABASE_URL':
        return 'Get from Supabase project settings > API > Project URL';
      case 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':
        return 'Get from Supabase project settings > API > Project API keys > anon/public';
      case 'SUPABASE_SECRET_KEY':
        return 'Get from Supabase project settings > API > Project API keys > service_role (keep secret!)';
      case 'MPESA_KMS_KEY':
        return 'Generate a 32-character hex string for AES-256-GCM encryption (keep secret!)';
      case 'NODE_ENV':
        return 'Set to "production" for production deployments';
      case 'VERCEL_ENV':
        return 'Automatically set by Vercel (development/preview/production)';
      default:
        return 'Configure according to your application requirements';
    }
  }
}

/**
 * Default environment validator instance
 */
export const environmentValidator = new EnvironmentValidator();