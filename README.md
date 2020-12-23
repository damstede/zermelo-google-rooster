# damstede-google-rooster
Rooster voor Damstede, geïmporteerd naar Google Calendar met Hangouts Meet link i.v.m. COVID-19

## Vereisten

- een Linux-server met [nodejs](https://nodejs.org/) en [npm](https://www.npmjs.com/get-npm)
- een G-suite-abonnement bij Google met docent- en leerlingaccounts
- een Zermelo-rooster met docent- en leerlingaccounts gekoppeld aan lessen
- kennis van G-suite, Google Calendar, Google Hangouts Meet, Zermelo
- een Zermelo-beheerder bij jou op school die een access token kan aanmaken met toegang tot alle roosters
- enige kennis van het Google Cloud Platform is niet vereist, maar kan wel van pas komen

De docent- en leerlingaccounts binnen G-suite dienen als alias (of als hoofd-e-mailadres) de gebruikersnaam van Zermelo te bevatten. Een voorbeeld:

- Leerling *n23443* in Zermelo dient een alias te hebben binnen G-suite: *n23443@domein.nl*
- Docent *nhs* in Zermelo dient een alias te hebben binnen G-suite: *nhs@domein.nl*



## Download
[Download](https://github.com/FreekBes/damstede-google-rooster/archive/master.zip) of kloon deze repository. Pak het ZIP-bestand uit indien je de repository hebt gedownload met behulp van de link.

## Installatie
Let op dat alle bestanden in een subfolder bewaard dienen te worden. Zet ze niet in een standaard downloads-folder of iets dergelijks.

Allereerst dien je een nieuw Google Cloud project aan te maken. Maak vervolgens OAuth2-credentials aan onder [APIs en services > Inloggegevens](https://console.cloud.google.com/apis/credentials). Doe dit door op "+ gegevens maken" te drukken, te kiezen voor "Client-ID OAuth", dan voor "Overige". Voer een naam in en druk op "maken". Als er wordt gevraagd om "redirect-URLs" op te geven, voeg dan `urn:ietf:wg:oauth:2.0:oob` en `http://localhost` toe.

Druk daarna in het overzicht van alle credentials op de net aangemaakte client-ID. Kies dan voor "JSON downloaden". Sla deze JSON op als `credentials.json` in de installatiemap. Dit bestand heeft een structuur die lijkt op het volgende:

```json
{
  "installed": {
    "client_id": "***",
    "project_id": "***",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "***",
    "redirect_uris": [
      "urn:ietf:wg:oauth:2.0:oob",
      "http://localhost"
    ]
}
```

Vervolgens dien je een serviceaccount aan te maken onder [IAM & Beheer > Serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts). Hieruit krijg je een bestand, wat gedownload moet worden en geplaatst dient te worden met de naam `service.json` in de installatiemap. Dit bestand heeft een structuur die lijkt op het volgende:

```json
{
  "type": "service_account",
  "project_id": "***",
  "private_key_id": "***",
  "private_key": "***",
  "client_email": "***",
  "client_id": "***",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/***"
}
```

In de installatiemap maak je vervolgens een bestand met de naam `credentials-z.json` aan met de volgende inhoud:

```json
{
  "school": "<SCHOOLNAAM_ZERMELO (subdomein zportal.nl, bijv. damstedelyceum)>",
  "token": "<TOKEN_ZERMELO (access token verkregen bij de beheerder van Zermelo op jouw school)>",
  "branch": "<BRANCH_ZERMELO (branch van het huidige schooljaar, bijv. 901)>"
}
```

**Dan, een belangrijke stap:** open vervolgens een terminal (command line interface), en run in de installatiemap het commando `npm install`. Wacht tot de installatie van de benodigde onderdelen is voltooid voor je doorgaat.


## Het script uitvoeren & first-time set-up

Run het commando `node main.js`.

Bij de eerste keer starten van het script wordt er gevraagd een Google-account te verbinden via OAuth2. Dit account zal worden gebruikt als systeembeheer-account. Als een docent niet kan worden gevonden in G-suite, dan wordt dit account aan de les gekoppeld. Tevens is dit account bij elke les uitgenodigd ter ondersteuning.

Er zal worden gevraagd een URL te bezoeken in een internetbrowser. Doe dit en log in met het Google-account van het systeembeheer op jouw school. Deze moet in G-suite zijn opgenomen. Na het inloggen geeft Google een code terug. Deze dient te worden ingevoerd in het terminalvenster.

Hierna zal de verbinding met Zermelo worden gemaakt en worden alle lessen voor de komende 24 uur opgehaald. Deze lessen worden gekoppeld aan de Google Agenda's van de docentenaccounts in G-suite, waarna de leerlingen als deelnemers worden toegevoegd. Dit werkt alleen als de [vereisten](https://github.com/FreekBes/damstede-google-rooster/#vereisten) juist zijn! Deze stap kan even duren.


## Automatiseren

Met behulp van cron kun je vervolgens het script automatisch laten draaien. Op Damstede kozen we ervoor elke 2 uur het script uit te voeren, m.u.v. de weekenden.

Voer het commando `sudo crontab -e` uit. Indien vereist, kies "nano" als editor.

Voeg aan het geopende bestand onderaan de volgende regels toe:
```bash
# Maandag tot en met donderdag
0 6,8,10,12,14,16,18,20,22 * * 1-4 node /pad/naar/installatiemap/main.js
# Vrijdag
0 6,8,10,12,14 * * 5 node /pad/naar/installatiemap/main.js
# Zondag
0 16,20,22 * * 7 node /pad/naar/installatiemap/main.js
```

Om de dagen en tijden aan te passen kan ik [crontab.guru](https://crontab.guru/) aanbevelen. Dit hulpprogramma laat ook zien wat er met welke regel wordt bedoeld. Probeer het maar eens uit!


## Ondersteuning voor foutoplossing

Mocht er iets mis gaan of niet lukken, maak dan gerust een [Issue](https://github.com/FreekBes/damstede-google-rooster/issues) aan. Ik ben bereid ondersteuning te bieden (tot op zekere hoogte).
