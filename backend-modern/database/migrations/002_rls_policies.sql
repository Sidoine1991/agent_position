-- Migration: 002_rls_policies.sql
-- Description: Row Level Security policies and triggers
-- Date: 2024-01-01

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

-- Enable RLS
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
