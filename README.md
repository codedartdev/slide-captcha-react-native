# @codedart/slide-captcha-react-native

Pacote TypeScript para usar um Laravel Slide CAPTCHA em apps React Native e Expo. Ele foi pensado para o fluxo de formulário mais comum: o desafio é pré-carregado em segundo plano, aparece somente quando o usuário toca em submit e, depois de resolvido, retorna um token para o submit real.

## Instalação

```sh
npm install @codedart/slide-captcha-react-native
```

O pacote declara `react` e `react-native` como peer dependencies.

## Backend Laravel

O backend deve expor:

```txt
GET  /slide-captcha/new
POST /slide-captcha/verify
```

`GET /slide-captcha/new` deve retornar:

```json
{
  "challenge_id": "uuid",
  "background_url": "http://192.168.0.10:8000/storage/captcha/bg.png",
  "piece_url": "http://192.168.0.10:8000/storage/captcha/piece.png",
  "piece_width": 64,
  "piece_height": 64,
  "image_width": 320,
  "image_height": 180,
  "rotation_enabled": true,
  "rotation_step": 15
}
```

`POST /slide-captcha/verify` recebe `challenge_id`, `x`, `y`, `rotation` e `movements`, e retorna `success`, `token`, `reason` e `message`.

## Uso com submit de formulário

```tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SlideCaptcha } from '@codedart/slide-captcha-react-native';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin(slideCaptchaToken: string) {
    setSubmitting(true);

    try {
      await fetch('http://192.168.0.10:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password, slideCaptchaToken }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />

      <Pressable disabled={submitting} onPress={() => setCaptchaVisible(true)}>
        <Text>{submitting ? 'Entrando...' : 'Entrar'}</Text>
      </Pressable>

      <SlideCaptcha
        baseUrl="http://192.168.0.10:8000"
        visible={captchaVisible}
        onRequestClose={() => setCaptchaVisible(false)}
        onSuccess={(token) => {
          setCaptchaVisible(false);
          void submitLogin(token);
        }}
        onError={() => {
          setSubmitting(false);
        }}
      />
    </View>
  );
}
```

## Client HTTP

```ts
import { createSlideCaptchaClient } from '@codedart/slide-captcha-react-native';

const client = createSlideCaptchaClient({
  baseUrl: 'http://192.168.0.10:8000',
  headers: {
    Accept: 'application/json',
  },
  fetcher: fetch,
});

const challenge = await client.getChallenge();
const response = await client.verifyChallenge({
  challenge_id: challenge.challenge_id,
  x: 120,
  y: 0,
  rotation: 0,
  movements: [{ x: 120, y: 0, r: 0, t: 450 }],
});
```

`baseUrl` deve ser absoluto. Em celular físico ou emulador, use o IP da sua máquina na rede, por exemplo `http://192.168.0.10:8000`, não `localhost`.

Em produção, use HTTPS para proteger credenciais, cookies, tokens de login e o token retornado pelo CAPTCHA. O uso de HTTP nos exemplos é apenas para desenvolvimento local.

## Erros

Erros são normalizados como `SlideCaptchaError`:

```ts
import { SlideCaptchaError } from '@codedart/slide-captcha-react-native';

<SlideCaptcha
  baseUrl="http://192.168.0.10:8000"
  visible={captchaVisible}
  onRequestClose={() => setCaptchaVisible(false)}
  onSuccess={handleToken}
  onError={(error) => {
    if (error instanceof SlideCaptchaError) {
      console.log(error.code, error.status, error.reason);
    }
  }}
/>;
```

Códigos comuns: `network_error`, `http_error`, `invalid_json`, `invalid_challenge`, `invalid_verify_payload`, `invalid_verify_response` e `verification_failed`.

## Textos e estilos

```tsx
<SlideCaptcha
  baseUrl="http://192.168.0.10:8000"
  visible={captchaVisible}
  onRequestClose={() => setCaptchaVisible(false)}
  onSuccess={handleToken}
  texts={{
    title: 'Verificação',
    description: 'Arraste a peça até o local correto.',
    verify: 'Confirmar',
    refresh: 'Novo desafio',
  }}
  style={{
    maxWidth: 380,
  }}
/>
```

O componente mede a largura disponível, preserva a proporção da imagem e converte as coordenadas renderizadas para `image_width`/`image_height` antes de verificar. Evite colocar o modal dentro de containers que forcem larguras muito pequenas.

## Exemplo Expo

Há um exemplo mínimo em `example/expo`.

```sh
cd example/expo
npm install
npm run start
```

Para testar localmente:

1. Suba o Laravel na rede, por exemplo `php artisan serve --host=0.0.0.0 --port=8000`.
2. Descubra o IP da máquina.
3. Configure `API_BASE_URL` em `example/expo/App.tsx`.

## Desenvolvimento

```sh
npm install
npm run typecheck
npm run test
npm run lint
npm run build
npm run format
```

## Publicação futura

```sh
npm login
npm run build
npm publish --access public
```

Antes de publicar, atualize `version`, `repository`, `homepage` e valide o exemplo Expo contra o backend Laravel real.
