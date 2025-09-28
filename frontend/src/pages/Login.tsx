import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Login() {
  const { signIn, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.success) {
        toast.success('Connexion réussie !');
      } else {
        toast.error(result.error || 'Erreur de connexion');
      }
    } catch (error) {
      toast.error('Une erreur inattendue s\'est produite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <img
            className="mx-auto h-16 w-16 rounded-xl shadow-soft"
            src="/Media/logo-ccrb.png"
            alt="CCR-B Logo"
          />
          <h2 className="mt-6 text-3xl font-bold text-neutral-900">
            Connexion
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Accédez à votre compte CCR-B
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <div className="card-body">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="label">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-700">
                    Se souvenir de moi
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                    Mot de passe oublié ?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary w-full"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  {isSubmitting ? 'Connexion...' : 'Se connecter'}
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600">
                  Pas encore de compte ?{' '}
                  <Link
                    to="/register"
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    Créer un compte
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-neutral-500">
            © 2024 CCR-B. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
