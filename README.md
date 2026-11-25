# Карта самопознания - Life by Design

Мобильное веб-приложение с тестами самопознания. Результаты можно получить на почту, а email попадает в MailerLite.

## Что в папке

- `index.html` - само приложение
- `netlify/functions/subscribe.mjs` - серверная часть: передает имя, email и результат в MailerLite (ключ API остается на сервере и не виден посетителям)
- `netlify.toml` - настройки для Netlify

## 1. Ключ API в MailerLite

MailerLite -> Integrations -> MailerLite API -> Generate new token. Назовите его "Карта самопознания" и скопируйте.

## 2. Сайт на Netlify

1. Создайте на GitHub новый репозиторий, например `lbd-karta`, и загрузите туда содержимое этой папки (Add file -> Upload files, можно перетащить всю папку).
2. Netlify -> Add new site -> Import an existing project -> GitHub -> выберите `lbd-karta`. Поля сборки оставьте пустыми, Deploy.
3. Site configuration -> Environment variables -> Add a variable: `MAILERLITE_API_KEY` = ваш ключ. Затем Deploys -> Trigger deploy.
4. Domain management -> Add a domain -> `test.lifebydesignglobal.com` (или любой другой поддомен).

## 3. Письмо с результатом (автоматизация в MailerLite)

После первой отправки формы в MailerLite сами появятся группы ("Карта: Языки любви" и другие) и поля `lbd_test`, `lbd_result`, `lbd_details`, `lbd_question`.

Automations -> Create workflow -> триггер "When subscriber joins a group" -> группа "Карта: Языки любви" -> шаг Email.
В настройках автоматизации включите повторное прохождение (repeat), чтобы письмо приходило и при повторном тесте.

Пример письма:

Тема: {$name}, ваш результат: {$lbd_test}

Привет, {$name}!

Спасибо, что прошли тест "{$lbd_test}".

Ваш результат: {$lbd_result}

{$lbd_details}

Вопрос коуча для размышления:
{$lbd_question}

С теплом,
Таня
Life by Design

Сделайте такую же автоматизацию для групп "Карта: Самоосознанность", "Карта: Самооценка" и "Карта: Тип мышления" (можно скопировать первую).

## Ссылки для группы

- Сразу тест на языки любви: `https://test.lifebydesignglobal.com/#quiz-love`
- Вся карта: `https://test.lifebydesignglobal.com`

## Что важно знать

- В рассылку Life by Design попадают только те, кто сам поставил галочку.
- Результаты хранятся в карточке подписчицы в MailerLite (поля `lbd_...`), уведомления вам не приходят.
- Ссылку на запись к вам можно вставить в `index.html`: строка `const BOOK_URL = "";`
