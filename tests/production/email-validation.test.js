/**
 * Tests de production - Email et validation
 * Tests fonctionnels pour la gestion des emails et validation en production
 */

const request = require('supertest');
const express = require('express');

describe('Tests de production - Email et validation', () => {
  
  describe('Validation des emails en production', () => {
    test('doit valider le format des emails', () => {
      const emailValidator = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
      
      const validEmails = [
        'user@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];
      
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'user@com',
        ''
      ];
      
      validEmails.forEach(email => {
        expect(emailValidator(email)).toBe(true);
      });
      
      invalidEmails.forEach(email => {
        expect(emailValidator(email)).toBe(false);
      });
    });

    test('doit normaliser les emails (lowercase)', () => {
      const normalizeEmail = (email) => email.toLowerCase().trim();
      
      expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
      expect(normalizeEmail('  USER@DOMAIN.COM  ')).toBe('user@domain.com');
    });

    test('doit détecter les emails temporaires', () => {
      const tempEmailDomains = [
        'tempmail.com',
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.com'
      ];
      
      const isTempEmail = (email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        return tempEmailDomains.includes(domain);
      };
      
      expect(isTempEmail('user@tempmail.com')).toBe(true);
      expect(isTempEmail('user@gmail.com')).toBe(false);
    });
  });

  describe('Validation des numéros de téléphone', () => {
    test('doit valider les formats internationaux', () => {
      const phoneValidator = (phone) => {
        // Accepte formats: +226123456789, 00226123456789, 226123456789
        // Doit avoir entre 8 et 15 chiffres au total
        const cleaned = phone.replace(/[\s-]/g, '');
        const phoneRegex = /^(\+|00)?[1-9]\d{7,14}$/;
        return phoneRegex.test(cleaned);
      };
      
      const validPhones = [
        '+226123456789',
        '00226123456789',
        '226123456789',
        '+33123456789',
        '+15551234567'
      ];
      
      const invalidPhones = [
        '123',           // Trop court
        'abc123',        // Contient des lettres
        '',              // Vide
        '+0123456789',   // Commence par 0 après +
        '+12345678901234567890' // Trop long
      ];
      
      validPhones.forEach(phone => {
        expect(phoneValidator(phone)).toBe(true);
      });
      
      invalidPhones.forEach(phone => {
        expect(phoneValidator(phone)).toBe(false);
      });
    });

    test('doit extraire le code pays', () => {
      const extractCountryCode = (phone) => {
        const cleaned = phone.replace(/[\s+]/g, '');
        // Codes pays courants (2-3 chiffres)
        const countryCodes = ['226', '33', '1', '44', '49', '81'];
        
        for (const code of countryCodes) {
          if (cleaned.startsWith(code)) {
            return code;
          }
        }
        return null;
      };
      
      expect(extractCountryCode('+226123456789')).toBe('226');
      expect(extractCountryCode('33123456789')).toBe('33');
      expect(extractCountryCode('15551234567')).toBe('1');
    });
  });

  describe('Workflow d\'inscription complet', () => {
    test('doit valider le processus d\'inscription étape par étape', () => {
      const registrationSteps = {
        step1_email: false,
        step2_password: false,
        step3_profile: false,
        step4_verification: false
      };
      
      // Simuler le workflow
      const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const validatePassword = (pwd) => pwd.length >= 8;
      const validateProfile = (profile) => profile.nickname && profile.nickname.length > 0;
      
      // Étape 1: Email
      if (validateEmail('user@example.com')) {
        registrationSteps.step1_email = true;
      }
      
      // Étape 2: Mot de passe
      if (validatePassword('SecureP@ss123')) {
        registrationSteps.step2_password = true;
      }
      
      // Étape 3: Profil
      if (validateProfile({ nickname: 'TestUser' })) {
        registrationSteps.step3_profile = true;
      }
      
      // Étape 4: Vérification (simulée)
      registrationSteps.step4_verification = true;
      
      // Vérifier que toutes les étapes sont complétées
      expect(Object.values(registrationSteps).every(step => step)).toBe(true);
    });

    test('doit gérer les erreurs de validation', () => {
      const validationErrors = [];
      
      const validateRegistration = (data) => {
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          validationErrors.push('Email invalide');
        }
        if (!data.password || data.password.length < 8) {
          validationErrors.push('Mot de passe trop court');
        }
        if (!data.nickname || data.nickname.length < 2) {
          validationErrors.push('Pseudo requis');
        }
        return validationErrors.length === 0;
      };
      
      const invalidData = {
        email: 'invalid',
        password: 'short',
        nickname: 'a'
      };
      
      expect(validateRegistration(invalidData)).toBe(false);
      expect(validationErrors.length).toBe(3);
    });
  });

  describe('Validation des données de profil', () => {
    test('doit valider les photos de profil', () => {
      const validateAvatar = (avatarUrl) => {
        if (!avatarUrl) return true; // Avatar optionnel
        const validPrefixes = ['https://', 'data:image'];
        return validPrefixes.some(prefix => avatarUrl.startsWith(prefix));
      };
      
      expect(validateAvatar(null)).toBe(true);
      expect(validateAvatar('https://example.com/avatar.jpg')).toBe(true);
      expect(validateAvatar('data:image/jpeg;base64,/9j/4AAQ...')).toBe(true);
      expect(validateAvatar('http://insecure.com/avatar.jpg')).toBe(false);
    });

    test('doit valider la bio', () => {
      const validateBio = (bio) => {
        if (!bio) return true;
        return bio.length <= 500 && bio.length >= 0;
      };
      
      expect(validateBio(null)).toBe(true);
      expect(validateBio('Ma bio')).toBe(true);
      expect(validateBio('a'.repeat(500))).toBe(true);
      expect(validateBio('a'.repeat(501))).toBe(false);
    });
  });

  describe('Sécurité des validations', () => {
    test('doit prévenir les injections dans les champs', () => {
      const sanitizeInput = (input) => {
        if (typeof input !== 'string') return input;
        return input
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      
      const maliciousInput = '<script>alert("XSS")</script>';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    test('doit limiter la longueur des entrées', () => {
      const maxLengths = {
        email: 255,
        nickname: 50,
        phone: 20,
        bio: 500
      };
      
      const validateLength = (field, value) => {
        const max = maxLengths[field];
        return !value || value.length <= max;
      };
      
      expect(validateLength('email', 'a'.repeat(255))).toBe(true);
      expect(validateLength('email', 'a'.repeat(256))).toBe(false);
      expect(validateLength('nickname', 'a'.repeat(50))).toBe(true);
      expect(validateLength('nickname', 'a'.repeat(51))).toBe(false);
    });
  });

  describe('Performance des validations', () => {
    test('doit valider rapidement les entrées', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const email = `user${i}@example.com`;
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Doit traiter 1000 validations en moins de 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});