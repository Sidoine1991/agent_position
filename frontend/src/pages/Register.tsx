import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Register() {
  const { signUp, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'agent',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      setIsSubmitting(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await signUp(formData.email, formData.password, formData.name, formData.role);
      
      if (result.success) {
        toast.success('Compte créé avec succès ! Vérifiez votre e-mail pour confirmer votre compte.');
      } else {
        toast.error(result.error || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      toast.error('Une erreur inattendue s\'est produite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <img
            className="mx-auto h-16 w-16 rounded-xl shadow-soft"
            src="/Media/logo-ccrb.png"
            alt="CCR-B Logo"
          />
          <h2 className="mt-6 text-3xl font-bold text-slate-900">
            Créer un compte
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Rejoignez l'équipe CCR-B
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <div className="card-body">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="label">
                  Nom complet
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="input"
                  placeholder="Jean Dupont"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

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
                <label htmlFor="role" className="label">
                  Rôle
                </label>
                <select
                  id="role"
                  name="role"
                  className="input"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="agent">Agent</option>
                  <option value="supervisor">Superviseur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Minimum 6 caractères
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>

              <div className="flex items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-slate-700">
                  J'accepte les{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    conditions d'utilisation
                  </a>{' '}
                  et la{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    politique de confidentialité
                  </a>
                </label>
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
                  {isSubmitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-600">
                  Déjà un compte ?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    Se connecter
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-500">
            © 2024 CCR-B. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
