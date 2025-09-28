-- Migration: 001_initial_schema.sql
-- Description: Initial database schema setup for Presence CCR-B
-- Date: 2024-01-01

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create presence table
CREATE TABLE IF NOT EXISTS presence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create missions table
CREATE TABLE IF NOT EXISTS missions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
    generated_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_presence_user_id ON presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_timestamp ON presence(timestamp);
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_user_timestamp ON presence(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_missions_assigned_to ON missions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_at ON missions(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
