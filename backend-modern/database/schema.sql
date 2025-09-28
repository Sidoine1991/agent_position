-- Presence CCR-B Database Schema
-- This file contains the complete database schema for the Presence CCR-B application

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
    location JSONB, -- {latitude, longitude, address}
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
    data JSONB, -- Report data and statistics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presence_updated_at BEFORE UPDATE ON presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Presence policies
CREATE POLICY "Users can view their own presence records" ON presence
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presence records" ON presence
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors and admins can view all presence records" ON presence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
        )
    );

-- Missions policies
CREATE POLICY "Users can view missions assigned to them" ON missions
    FOR SELECT USING (auth.uid() = assigned_to);

CREATE POLICY "Users can insert missions" ON missions
    FOR INSERT WITH CHECK (auth.uid() = assigned_to);

CREATE POLICY "Users can update missions assigned to them" ON missions
    FOR UPDATE USING (auth.uid() = assigned_to);

CREATE POLICY "Admins can view all missions" ON missions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all missions" ON missions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete all missions" ON missions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Reports policies
CREATE POLICY "Users can view their own reports" ON reports
    FOR SELECT USING (auth.uid() = generated_by);

CREATE POLICY "Users can insert reports" ON reports
    FOR INSERT WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "Users can update their own reports" ON reports
    FOR UPDATE USING (auth.uid() = generated_by);

CREATE POLICY "Users can delete their own reports" ON reports
    FOR DELETE USING (auth.uid() = generated_by);

CREATE POLICY "Supervisors and admins can view all reports" ON reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
        )
    );

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert default admin user (optional - for initial setup)
-- This should be done manually or through the application
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES (
--     uuid_generate_v4(),
--     'admin@ccrb.bj',
--     crypt('admin123', gen_salt('bf')),
--     NOW(),
--     NOW(),
--     NOW()
-- );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
