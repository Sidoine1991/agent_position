#!/usr/bin/env node

/**
 * Simple API Test Script
 * Tests the basic functionality of the Presence CCR-B API
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Presence CCR-B API...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await makeRequest('/health');
    if (healthResponse.status === 200 && healthResponse.data.status === 'OK') {
      console.log('   ✅ Health check passed');
    } else {
      console.log('   ❌ Health check failed:', healthResponse.data);
    }

    // Test 2: 404 Handler
    console.log('\n2. Testing 404 handler...');
    const notFoundResponse = await makeRequest('/api/nonexistent');
    if (notFoundResponse.status === 404) {
      console.log('   ✅ 404 handler working');
    } else {
      console.log('   ❌ 404 handler failed:', notFoundResponse.data);
    }

    // Test 3: Auth endpoints (without credentials)
    console.log('\n3. Testing auth endpoints...');
    const loginResponse = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'test123' }
    });
    if (loginResponse.status === 400 || loginResponse.status === 401) {
      console.log('   ✅ Auth validation working');
    } else {
      console.log('   ❌ Auth validation failed:', loginResponse.data);
    }

    // Test 4: Protected routes
    console.log('\n4. Testing protected routes...');
    const usersResponse = await makeRequest('/api/users');
    if (usersResponse.status === 401) {
      console.log('   ✅ Protected routes working');
    } else {
      console.log('   ❌ Protected routes failed:', usersResponse.data);
    }

    console.log('\n🎉 Basic API tests completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Set up your Supabase project');
    console.log('   2. Configure environment variables');
    console.log('   3. Run database migrations: npm run setup-db');
    console.log('   4. Create your first user');
    console.log('   5. Test with real authentication');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the API server is running: npm run dev');
  }
}

// Run tests
runTests();
