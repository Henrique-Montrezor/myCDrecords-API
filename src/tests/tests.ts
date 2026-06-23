import * as fs from 'fs';
import * as path from 'path';
import { initDatabase } from '../mysql2/init.database';

interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  message: string;
  timestamp: string;
}

interface TestLog {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
  startTime: string;
  endTime: string;
  duration: number;
}

class ProjectTester {
  private testResults: TestResult[] = [];
  private startTime: Date = new Date();
  private endTime: Date = new Date();

  async runAllTests(): Promise<TestLog> {
    console.log('🔍 Starting project health check...\n');
    this.startTime = new Date();

    await this.checkModules();
    await this.checkDatabase();
    await this.checkEnvironment();
    await this.checkDependencies();

    this.endTime = new Date();
    return this.generateTestLog();
  }

  private async checkModules(): Promise<void> {
    console.log('📦 Checking modules...');
    try {
      const srcPath = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcPath)) {
        const modules = fs.readdirSync(srcPath);
        this.addResult('Module Structure', 'passed', `Found ${modules.length} modules: ${modules.join(', ')}`);
      } else {
        this.addResult('Module Structure', 'failed', 'src directory not found');
      }
    } catch (error) {
      this.addResult('Module Structure', 'failed', `Error checking modules: ${error}`);
    }
  }

  private async checkDatabase(): Promise<void> {
    console.log('🗄️  Checking database connection...');
    const connection = await initDatabase();

    if (connection) {
        this.addResult('Database Connection', 'passed', 'Successfully connected to the database');
    } else {
        this.addResult('Database Connection', 'failed', 'Failed to connect to the database');
    }
}

  private async checkEnvironment(): Promise<void> {
    console.log('⚙️  Checking environment...');
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        this.addResult('Environment Variables', 'passed', '.env file exists');
      } else {
        this.addResult('Environment Variables', 'failed', '.env file not found');
      }
      
      this.addResult('Node Environment', 'passed', `Running on Node.js ${process.version}`);
    } catch (error) {
      this.addResult('Environment', 'failed', `Environment check error: ${error}`);
    }
  }

  private async checkDependencies(): Promise<void> {
    console.log('📚 Checking dependencies...');
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = Object.keys(packageJson.dependencies || {}).length;
        const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
        this.addResult('Dependencies', 'passed', `${dependencies} dependencies, ${devDependencies} dev dependencies found`);
      } else {
        this.addResult('Dependencies', 'failed', 'package.json not found');
      }
    } catch (error) {
      this.addResult('Dependencies', 'failed', `Dependency check error: ${error}`);
    }
  }

  private loadDatabaseConfig(): boolean {
    try {
      // Attempt to load database configuration from environment or config files
      return !!process.env.DATABASE_URL || !!process.env.DB_HOST;
    } catch {
      return false;
    }
  }

  private addResult(name: string, status: 'passed' | 'failed', message: string): void {
    this.testResults.push({
      name,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
    const icon = status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${name}: ${message}`);
  }

  private generateTestLog(): TestLog {
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = this.testResults.filter(r => r.status === 'failed').length;

    return {
      totalTests: this.testResults.length,
      passedTests,
      failedTests,
      results: this.testResults,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      duration: this.endTime.getTime() - this.startTime.getTime(),
    };
  }
}

// Export test runner and log
export async function runProjectTests(): Promise<TestLog> {
  const tester = new ProjectTester();
  const testLog = await tester.runAllTests();
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testLog.totalTests}`);
  console.log(`✅ Passed: ${testLog.passedTests}`);
  console.log(`❌ Failed: ${testLog.failedTests}`);
  console.log(`⏱️  Duration: ${testLog.duration}ms`);
  console.log('='.repeat(50) + '\n');

  return testLog;
}

// Run tests if executed directly
if (require.main === module) {
  runProjectTests().catch(console.error);
}
