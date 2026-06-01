import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SlideCaptcha } from '@codedart/slide-captcha-react-native';

const API_BASE_URL = 'http://192.168.0.10:8000';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaError, setCaptchaError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmitPress() {
    setFormError('');
    setCaptchaError('');

    if (!email.trim() || !password) {
      setFormError('Informe email e senha.');
      return;
    }

    setCaptchaVisible(true);
  }

  async function submitLogin(slideCaptchaToken: string) {
    setSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          slide_captcha_token: slideCaptchaToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Não foi possível entrar com os dados informados.');
      }

      Alert.alert('Login enviado', 'O formulário foi enviado com o token do CAPTCHA.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro inesperado no login.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>O desafio será exibido somente ao enviar.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@example.com"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              style={styles.input}
            />
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {captchaError ? <Text style={styles.errorText}>{captchaError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSubmitPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SlideCaptcha
        baseUrl={API_BASE_URL}
        visible={captchaVisible}
        onRequestClose={() => setCaptchaVisible(false)}
        onSuccess={(token) => {
          setCaptchaVisible(false);
          void submitLogin(token);
        }}
        onError={(error) => {
          setCaptchaError(error.message);
        }}
        texts={{
          title: 'Verificação',
          description: 'Arraste a peça até completar a imagem.',
          verify: 'Continuar',
          refresh: 'Novo desafio',
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 16,
  },
  errorText: {
    marginBottom: 12,
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f766e',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
});
