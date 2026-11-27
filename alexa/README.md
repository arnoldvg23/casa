# Casa con Alexa

Con esto puedes decir:

- «Alexa, dile a mi casa que añada leche y huevos»
- «Alexa, pide a mi casa que apunte dos litros de leche»
- «Alexa, pregunta a mi casa qué hay en la lista»

Alexa no habla catalán, así que se le habla en castellano, pero en la lista los productos
salen en catalán cuando están en el catálogo de la app («leche» → «Llet»), con su categoría,
y cuentan para los «Habituals» igual que si los hubieras escrito.

## Cómo funciona

1. La skill «Mi casa» (privada, solo en tu cuenta de Amazon) envía lo que dices a la
   Cloud Function `alexa` de Firebase (`europe-west1`).
2. La función comprueba que la petición viene firmada por Amazon y la escribe en Firestore.
3. Para saber qué hogar es, se vincula una vez: en la app, **Ajustos → Connecta amb Alexa**
   da un código de 6 cifras (dura 15 minutos y sirve una sola vez) y le dices a Alexa
   «Alexa, dile a mi casa que mi código es 482913».

## Puesta en marcha (una sola vez)

### 1. Plan Blaze en Firebase

Las Cloud Functions necesitan el plan Blaze (pago por uso). Con este uso no se paga nada:
la capa gratuita da 2 millones de llamadas al mes. Se activa en
<https://console.firebase.google.com/project/casa-9522a/usage/details>. Conviene poner una
alerta de presupuesto de 1 €.

### 2. Publicar la función y las reglas

En la carpeta del proyecto:

```
cd functions
npm install
cd ..
npx firebase-tools login
npx firebase-tools deploy --only functions:alexa,firestore:rules --project casa-9522a
```

Al terminar muestra la dirección de la función, del estilo
`https://europe-west1-casa-9522a.cloudfunctions.net/alexa`.

### 3. Crear la skill en Amazon

1. Entra en <https://developer.amazon.com/alexa/console/ask> con **la misma cuenta de Amazon
   que tu Echo** (si no tienes cuenta de desarrollador, se crea ahí mismo, gratis).
2. **Create Skill** → nombre «Casa», idioma **Spanish (ES)**, tipo **Other → Custom**,
   hosting **Provision your own**, plantilla **Start from Scratch**.
3. **Build → Interaction Model → JSON Editor**: pega el contenido de
   [`model.es-ES.json`](model.es-ES.json), **Save** y **Build skill**.
4. **Build → Endpoint**: **HTTPS**, en *Default Region* pega la dirección del paso 2 y en el
   desplegable elige *My development endpoint is a sub-domain of a domain that has a wildcard
   certificate from a certificate authority*. **Save**.
5. Pestaña **Test**: cambia *Off* por **Development**. Desde ese momento funciona en tus Echo.
6. (Recomendado) Copia el **Skill ID** (`amzn1.ask.skill...`) y ponlo en `functions/.env`:
   `ALEXA_SKILL_ID=amzn1.ask.skill...`. Vuelve a publicar la función: así solo responde a tu skill.

### 4. Vincular tu casa

En la app: **Ajustos → Connecta amb Alexa**, y di el código que sale. Cada persona con
Echo propio lo hace una vez desde su móvil (lo que añada saldrá con su nombre).

Para desconectar: «Alexa, dile a mi casa que olvide mi casa», o desactiva la skill.

## Desarrollo

- `npm test` prueba la lógica de la skill (`tests/alexa.test.mjs`) sin red.
- `npm run test:rules` prueba las reglas (`alexaCodes`, `alexaLinks`).
- Si cambia el catálogo (`js/products.js`), `node alexa/build-model.mjs` regenera el modelo
  de voz y hay que volver a pegarlo en la consola de Alexa.
- `functions/shared/` es una copia de `js/products.js` y `js/habits.js` que hace el
  `predeploy` antes de publicar; no se sube al repo.
