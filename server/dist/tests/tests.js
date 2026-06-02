"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProjectTests = runProjectTests;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const init_database_1 = require("../mysql2/init.database");
class ProjectTester {
    constructor() {
        this.testResults = [];
        this.startTime = new Date();
        this.endTime = new Date();
    }
    async runAllTests() {
        console.log('🔍 Starting project health check...\n');
        this.startTime = new Date();
        await this.checkModules();
        await this.checkDatabase();
        await this.checkEnvironment();
        await this.checkDependencies();
        this.endTime = new Date();
        return this.generateTestLog();
    }
    async checkModules() {
        console.log('📦 Checking modules...');
        try {
            const srcPath = path.join(process.cwd(), 'src');
            if (fs.existsSync(srcPath)) {
                const modules = fs.readdirSync(srcPath);
                this.addResult('Module Structure', 'passed', `Found ${modules.length} modules: ${modules.join(', ')}`);
            }
            else {
                this.addResult('Module Structure', 'failed', 'src directory not found');
            }
        }
        catch (error) {
            this.addResult('Module Structure', 'failed', `Error checking modules: ${error}`);
        }
    }
    async checkDatabase() {
        console.log('🗄️  Checking database connection...');
        const connection = await (0, init_database_1.initDatabase)();
        if (connection) {
            this.addResult('Database Connection', 'passed', 'Successfully connected to the database');
        }
        else {
            this.addResult('Database Connection', 'failed', 'Failed to connect to the database');
        }
    }
    async checkEnvironment() {
        console.log('⚙️  Checking environment...');
        try {
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                this.addResult('Environment Variables', 'passed', '.env file exists');
            }
            else {
                this.addResult('Environment Variables', 'failed', '.env file not found');
            }
            this.addResult('Node Environment', 'passed', `Running on Node.js ${process.version}`);
        }
        catch (error) {
            this.addResult('Environment', 'failed', `Environment check error: ${error}`);
        }
    }
    async checkDependencies() {
        console.log('📚 Checking dependencies...');
        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const dependencies = Object.keys(packageJson.dependencies || {}).length;
                const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
                this.addResult('Dependencies', 'passed', `${dependencies} dependencies, ${devDependencies} dev dependencies found`);
            }
            else {
                this.addResult('Dependencies', 'failed', 'package.json not found');
            }
        }
        catch (error) {
            this.addResult('Dependencies', 'failed', `Dependency check error: ${error}`);
        }
    }
    loadDatabaseConfig() {
        try {
            // Attempt to load database configuration from environment or config files
            return !!process.env.DATABASE_URL || !!process.env.DB_HOST;
        }
        catch {
            return false;
        }
    }
    addResult(name, status, message) {
        this.testResults.push({
            name,
            status,
            message,
            timestamp: new Date().toISOString(),
        });
        const icon = status === 'passed' ? '✅' : '❌';
        console.log(`${icon} ${name}: ${message}`);
    }
    generateTestLog() {
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
async function runProjectTests() {
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
//# sourceMappingURL=tests.js.map