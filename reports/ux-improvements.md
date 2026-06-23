# Recomendações e Melhorias de UX/UI — Zapflow CRM

Com base nos resultados capturados pelos scanners automáticos, listamos melhorias ergonômicas e funcionais:

---

## ⚡ 1. Desempenho e Velocidade de Carregamento
Telas que levaram mais de 1.0 segundo para renderização inicial e sincronismo de APIs:


| Tela | Tempo de Carga | Status |
|---|---|---|
| `/contacts` | `1536ms` | 🟢 OK |
| `/ai` | `1368ms` | 🔴 Falha |
| `/connections` | `1313ms` | 🟢 OK |
| `/flows` | `1280ms` | 🟢 OK |
| `/dashboard` | `1201ms` | 🟢 OK |
| `/diagnostics` | `1193ms` | 🟢 OK |
| `/deployments` | `1154ms` | 🟢 OK |
| `/analytics` | `1150ms` | 🟢 OK |
| `/memory` | `1108ms` | 🟢 OK |
| `/users` | `1074ms` | 🟢 OK |
| `/campaigns` | `1063ms` | 🟢 OK |
| `/logs` | `1054ms` | 🟢 OK |
| `/nodes` | `1040ms` | 🟢 OK |


**Sugestão:** Implementar skeletons de carregamento eficientes e adiar o fetch de logs ou dados históricos pesados nas telas Master.

---

## ♿ 2. Acessibilidade (WCAG Conformance)
Rotas com maiores violações de contraste ou falta de tags de acessibilidade (como aria labels):


### Rota: `/dashboard` (6 violações)

* **Regra:** `aria-valid-attr-value` (Impacto: **critical**)
  - *Descrição:* Ensure all ARIA attributes have valid values (`ARIA attributes must conform to valid values`)
  - *Afetados:* 1 elementos.


* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `svg-img-alt` (Impacto: **serious**)
  - *Descrição:* Ensure <svg> elements with an img, graphics-document or graphics-symbol role have accessible text (`<svg> elements with an img role must have alternative text`)
  - *Afetados:* 2 elementos.



### Rota: `/connections` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 3 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/contacts` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 36 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 4 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/flows` (5 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 2 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `label` (Impacto: **critical**)
  - *Descrição:* Ensure every form element has a label (`Form elements must have labels`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/ai` (7 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 2 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 2 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-main-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the main landmark is at top level (`Main landmark should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-no-duplicate-main` (Impacto: **moderate**)
  - *Descrição:* Ensure the document has at most one main landmark (`Document should not have more than one main landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-unique` (Impacto: **moderate**)
  - *Descrição:* Ensure landmarks are unique (`Landmarks should have a unique role or role/label/title (i.e. accessible name) combination`)
  - *Afetados:* 2 elementos.



### Rota: `/analytics` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `svg-img-alt` (Impacto: **serious**)
  - *Descrição:* Ensure <svg> elements with an img, graphics-document or graphics-symbol role have accessible text (`<svg> elements with an img role must have alternative text`)
  - *Afetados:* 2 elementos.



### Rota: `/campaigns` (5 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 36 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 4 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `nested-interactive` (Impacto: **serious**)
  - *Descrição:* Ensure interactive controls are not nested as they are not always announced by screen readers or can cause focus problems for assistive technologies (`Interactive controls must not be nested`)
  - *Afetados:* 35 elementos.



### Rota: `/memory` (5 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 2 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `svg-img-alt` (Impacto: **serious**)
  - *Descrição:* Ensure <svg> elements with an img, graphics-document or graphics-symbol role have accessible text (`<svg> elements with an img role must have alternative text`)
  - *Afetados:* 3 elementos.



### Rota: `/users` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/nodes` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/deployments` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/logs` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 1 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/diagnostics` (4 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 2 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 11 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.



### Rota: `/settings` (5 violações)

* **Regra:** `button-name` (Impacto: **critical**)
  - *Descrição:* Ensure buttons have discernible text (`Buttons must have discernible text`)
  - *Afetados:* 1 elementos.


* **Regra:** `color-contrast` (Impacto: **serious**)
  - *Descrição:* Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (`Elements must meet minimum color contrast ratio thresholds`)
  - *Afetados:* 3 elementos.


* **Regra:** `heading-order` (Impacto: **moderate**)
  - *Descrição:* Ensure the order of headings is semantically correct (`Heading levels should only increase by one`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-complementary-is-top-level` (Impacto: **moderate**)
  - *Descrição:* Ensure the complementary landmark or aside is at top level (`Aside should not be contained in another landmark`)
  - *Afetados:* 1 elementos.


* **Regra:** `landmark-unique` (Impacto: **moderate**)
  - *Descrição:* Ensure landmarks are unique (`Landmarks should have a unique role or role/label/title (i.e. accessible name) combination`)
  - *Afetados:* 1 elementos.


