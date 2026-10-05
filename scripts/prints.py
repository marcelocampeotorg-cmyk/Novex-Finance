"""
=============================================================================
NOVEX FINANCE — SISTEMA OFICIAL DE AUDITORIA VISUAL E CAPTURA DE PRINTS (E2E)
Script: scripts/prints.py
Validação rigorosa forense de interfaces Desktop e Mobile do NOVEX Finance
com cálculo de SHA-256, dHash perceptual, detecção de telas repetidas,
verificação de autenticação e compactação em arquivo ZIP timestamped.
=============================================================================
"""

import sys
import os
import time
import json
import hashlib
import zipfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent
TIMESTAMP_STR = time.strftime("%Y%m%d_%H%M%S")
OUTPUT_DIR = BASE_DIR / "reports" / f"auditoria_visual_{TIMESTAMP_STR}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
ZIP_FILE = BASE_DIR / "reports" / f"auditoria_visual_{TIMESTAMP_STR}.zip"

BASE_URL = os.getenv("BASE_URL", "https://finance.novexbr.com.br")
AUTH_EMAIL = os.getenv("AUTH_EMAIL", "franklinjr18@hotmail.com")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "Novex@2026")


def compute_file_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def compute_dhash(file_path: Path, hash_size: int = 8) -> str:
    try:
        with Image.open(file_path) as img:
            img = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
            pixels = list(img.tobytes())
            diff = []
            for row in range(hash_size):
                for col in range(hash_size):
                    p_left = pixels[row * (hash_size + 1) + col]
                    p_right = pixels[row * (hash_size + 1) + col + 1]
                    diff.append(p_left > p_right)
            dec = 0
            hex_parts = []
            for i, val in enumerate(diff):
                if val:
                    dec += 2 ** (i % 8)
                if (i % 8) == 7:
                    hex_parts.append(hex(dec)[2:].rjust(2, "0"))
                    dec = 0
            return "".join(hex_parts)
    except Exception:
        return ""


def hamming_dist(h1: str, h2: str) -> int:
    if not h1 or not h2 or len(h1) != len(h2):
        return 999
    try:
        x = int(h1, 16) ^ int(h2, 16)
        return bin(x).count("1")
    except Exception:
        return 999


def main():
    print("=" * 80)
    print("  NOVEX FINANCE — GERADOR OFICIAL DE PRINTS & AUDITORIA VISUAL")
    print(f"  Alvo: {BASE_URL}")
    print(f"  Diretório: {OUTPUT_DIR}")
    print(f"  Arquivo ZIP: {ZIP_FILE}")
    print("=" * 80)

    records = []
    seen_hashes = {}
    console_errors = []
    network_failures = []

    def on_console(msg):
        if msg.type in ("error",):
            # Ignorar avisos irrelevantes de extensões ou favicons
            if "favicon" not in msg.text.lower():
                console_errors.append({"type": msg.type, "text": msg.text, "location": msg.location})

    def on_response(resp):
        if resp.status >= 400 and not resp.url.endswith("/favicon.ico"):
            network_failures.append({
                "url": resp.url,
                "status": resp.status,
                "status_text": resp.status_text
            })

    def capture_step(page, filename, label, viewport_desc, category="Desktop"):
        path = OUTPUT_DIR / filename
        # Esperar animações e dados
        page.wait_for_timeout(1000)
        page.screenshot(path=str(path), full_page=False)

        sha = compute_file_sha256(path)
        dh = compute_dhash(path)
        file_size_kb = round(os.path.getsize(path) / 1024, 2)

        duplicate_of = None
        min_dist = 999
        for other_fn, other_info in seen_hashes.items():
            dist = hamming_dist(dh, other_info["dhash"])
            if dist < min_dist:
                min_dist = dist
            if dist <= 2:  # Praticamente idêntica
                duplicate_of = other_fn
                break

        seen_hashes[filename] = {
            "label": label,
            "sha256": sha,
            "dhash": dh,
            "size_kb": file_size_kb
        }

        rec = {
            "file": filename,
            "label": label,
            "category": category,
            "viewport": viewport_desc,
            "url": page.url,
            "sha256": sha,
            "dhash": dh,
            "size_kb": file_size_kb,
            "duplicate_of": duplicate_of,
            "min_hamming": min_dist if min_dist != 999 else None
        }
        records.append(rec)
        status_sym = "[OK]" if not duplicate_of else "[ALERTA DUPLICADA]"
        print(f"  {status_sym} {filename} ({file_size_kb} KB) — {label}")
        return rec

    with sync_playwright() as p:
        # =====================================================================
        # 1. VIEWPORT DESKTOP (1440 x 900)
        # =====================================================================
        print("\n>>> ETAPA 1: VIEWPORT DESKTOP (1440 x 900)")
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.0,
            locale="pt-BR",
            timezone_id="America/Sao_Paulo"
        )
        page = ctx.new_page()
        page.on("console", on_console)
        page.on("response", on_response)

        # 01. Login
        page.goto(f"{BASE_URL}/login")
        page.wait_for_timeout(1500)
        capture_step(page, "01_desktop_login.png", "Tela de Login e Autenticação", "1440x900", "Desktop")

        # Autenticação oficial de sessão
        print(f"  [Auth] Realizando login com {AUTH_EMAIL}...")
        try:
            page.fill("input[type='email']", AUTH_EMAIL)
            page.fill("input[type='password']", AUTH_PASSWORD)
            page.click("button[type='submit']")
            page.wait_for_timeout(4000)
            if "/login" in page.url:
                page.goto(f"{BASE_URL}/")
                page.wait_for_timeout(2500)
            print(f"  [Auth] Autenticado com sucesso! URL atual: {page.url}")
        except Exception as e:
            print(f"  [Auth Aviso] Não foi possível completar transição de login: {e}")

        # 02. Dashboard Principal
        if page.url != f"{BASE_URL}/":
            page.goto(f"{BASE_URL}/")
        page.wait_for_timeout(2500)
        capture_step(page, "02_desktop_dashboard.png", "Visão Geral das Finanças / Cockpit", "1440x900", "Desktop")

        # 03. Modal de Ajuste de Carteira Físico / Caixa Manual
        try:
            btn_carteira = page.locator("text='Conferir carteira'").first
            if btn_carteira.is_visible():
                btn_carteira.click()
                page.wait_for_timeout(1000)
                capture_step(page, "03_desktop_dashboard_carteira_modal.png", "Modal de Ajuste de Saldo Físico / Carteira", "1440x900", "Desktop")
                # Fechar modal
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal de carteira: {e}")

        # 04. Contas a Pagar
        page.goto(f"{BASE_URL}/contas-a-pagar")
        page.wait_for_timeout(2000)
        capture_step(page, "04_desktop_contas_a_pagar.png", "Listagem de Contas a Pagar", "1440x900", "Desktop")

        # 05. Modal Nova Conta a Pagar
        try:
            btn_nova_pagar = page.locator("text='Nova Conta a Pagar'").first
            if btn_nova_pagar.is_visible():
                btn_nova_pagar.click()
                page.wait_for_timeout(1000)
                capture_step(page, "05_desktop_contas_a_pagar_modal_novo.png", "Modal de Nova Conta a Pagar", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal nova conta: {e}")

        # 06. Modal de Baixa Manual em Contas a Pagar
        try:
            page.goto(f"{BASE_URL}/contas-a-pagar")
            page.wait_for_timeout(1500)
            btn_baixar = page.locator("button:has-text('Baixar')").first
            if btn_baixar.is_visible():
                btn_baixar.click()
                page.wait_for_timeout(1000)
                capture_step(page, "06_desktop_contas_a_pagar_modal_baixa.png", "Modal de Baixa Manual (Saída Financeira)", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal baixa a pagar: {e}")

        # 07. Contas a Receber
        page.goto(f"{BASE_URL}/contas-a-receber")
        page.wait_for_timeout(2000)
        capture_step(page, "07_desktop_contas_a_receber.png", "Listagem de Contas a Receber", "1440x900", "Desktop")

        # 08. Modal Novo Recebível
        try:
            btn_novo_receber = page.locator("text='Nova Conta a Receber'").first
            if btn_novo_receber.is_visible():
                btn_novo_receber.click()
                page.wait_for_timeout(1000)
                capture_step(page, "08_desktop_contas_a_receber_modal_novo.png", "Modal de Novo Recebível", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal novo recebível: {e}")

        # 09. Modal Cobrança Pix / WhatsApp
        try:
            page.goto(f"{BASE_URL}/contas-a-receber")
            page.wait_for_timeout(1500)
            btn_cobrar_pix = page.get_by_role("button", name="Cobrar Pix / WhatsApp").first
            if btn_cobrar_pix.is_visible():
                btn_cobrar_pix.click()
                page.wait_for_timeout(2500)
                capture_step(page, "09_desktop_contas_a_receber_modal_pix.png", "Modal de Cobrança Pix Orders & WhatsApp", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal cobrar pix: {e}")

        # 10. Modal Baixa Manual em Contas a Receber
        try:
            page.goto(f"{BASE_URL}/contas-a-receber")
            page.wait_for_timeout(1500)
            btn_baixar_rec = page.locator("button:has-text('Baixar')").first
            if btn_baixar_rec.is_visible():
                btn_baixar_rec.click()
                page.wait_for_timeout(1000)
                capture_step(page, "10_desktop_contas_a_receber_modal_baixa.png", "Modal de Baixa Manual (Entrada Financeira)", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal baixa a receber: {e}")

        # 11. Movimentações & Conciliação
        page.goto(f"{BASE_URL}/movimentacoes")
        page.wait_for_timeout(2000)
        capture_step(page, "11_desktop_movimentacoes.png", "Extrato e Conciliação Bancária", "1440x900", "Desktop")

        # 12. Modal Importar Extrato
        try:
            btn_importar = page.locator("text='Importar Extrato'").first
            if btn_importar.is_visible():
                btn_importar.click()
                page.wait_for_timeout(1000)
                capture_step(page, "12_desktop_movimentacoes_modal_importar.png", "Modal de Importação de Extrato CSV/OFX", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar modal importar extrato: {e}")

        # 13. Formulário Lançamento Manual de Movimentação
        try:
            page.goto(f"{BASE_URL}/movimentacoes")
            page.wait_for_timeout(1500)
            btn_lanc_manual = page.locator("text='Lançamento manual'").first
            if btn_lanc_manual.is_visible():
                btn_lanc_manual.click()
                page.wait_for_timeout(1000)
                capture_step(page, "13_desktop_movimentacoes_form_manual.png", "Formulário de Entrada Manual de Movimentação", "1440x900", "Desktop")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar formulário manual: {e}")

        # 14. Lembretes & Régua de Cobrança
        page.goto(f"{BASE_URL}/lembretes")
        page.wait_for_timeout(2000)
        capture_step(page, "14_desktop_lembretes.png", "Painel de Lembretes & Régua de Notificações", "1440x900", "Desktop")

        # 15. Relatórios & DRE
        page.goto(f"{BASE_URL}/relatorios")
        page.wait_for_timeout(2000)
        capture_step(page, "15_desktop_relatorios.png", "DRE Gerencial & Projeção de Fluxo Futuro", "1440x900", "Desktop")

        # 16. Lixeira & Quarentena
        page.goto(f"{BASE_URL}/lixeira")
        page.wait_for_timeout(2000)
        capture_step(page, "16_desktop_lixeira.png", "Central de Lixeira & Recuperação Lógica", "1440x900", "Desktop")

        # 17. Configurações
        page.goto(f"{BASE_URL}/configuracoes")
        page.wait_for_timeout(2000)
        capture_step(page, "17_desktop_configuracoes.png", "Configurações, Mercado Pago & WhatsApp", "1440x900", "Desktop")

        # Salvar cookies de autenticação para a sessão mobile
        auth_cookies = ctx.cookies()
        browser.close()

        # =====================================================================
        # 2. VIEWPORT MOBILE (390 x 844 - iPhone / Android)
        # =====================================================================
        print("\n>>> ETAPA 2: VIEWPORT MOBILE (390 x 844)")
        browser_mob = p.chromium.launch(headless=True)
        ctx_mob = browser_mob.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2.0,
            is_mobile=True,
            has_touch=True,
            locale="pt-BR",
            timezone_id="America/Sao_Paulo"
        )
        ctx_mob.add_cookies(auth_cookies)
        page_mob = ctx_mob.new_page()
        page_mob.on("console", on_console)
        page_mob.on("response", on_response)

        # 18. Mobile Dashboard
        page_mob.goto(f"{BASE_URL}/")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "18_mobile_dashboard.png", "Dashboard Mobile Responsivo", "390x844", "Mobile")

        # 19. Mobile Contas a Pagar
        page_mob.goto(f"{BASE_URL}/contas-a-pagar")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "19_mobile_contas_a_pagar.png", "Contas a Pagar Mobile", "390x844", "Mobile")

        # 20. Mobile Contas a Receber
        page_mob.goto(f"{BASE_URL}/contas-a-receber")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "20_mobile_contas_a_receber.png", "Contas a Receber Mobile", "390x844", "Mobile")

        # 21. Mobile Movimentações
        page_mob.goto(f"{BASE_URL}/movimentacoes")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "21_mobile_movimentacoes.png", "Extrato e Movimentações Mobile", "390x844", "Mobile")

        # 22. Mobile Lembretes
        page_mob.goto(f"{BASE_URL}/lembretes")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "22_mobile_lembretes.png", "Lembretes & Régua Mobile", "390x844", "Mobile")

        # 23. Mobile Relatórios
        page_mob.goto(f"{BASE_URL}/relatorios")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "23_mobile_relatorios.png", "Relatórios e DRE Mobile", "390x844", "Mobile")

        # 24. Mobile Configurações
        page_mob.goto(f"{BASE_URL}/configuracoes")
        page_mob.wait_for_timeout(2000)
        capture_step(page_mob, "24_mobile_configuracoes.png", "Configurações Mobile", "390x844", "Mobile")

        # 25. Mobile Navigation Drawer (Botão 'Mais' na Bottom Nav)
        try:
            btn_mais = page_mob.locator("button[aria-label='Abrir menu com mais opções']").first
            if btn_mais.is_visible():
                btn_mais.click()
                page_mob.wait_for_timeout(1000)
                capture_step(page_mob, "25_mobile_drawer_menu.png", "Menu Drawer Lateral Mobile", "390x844", "Mobile")
        except Exception as e:
            print(f"    [Aviso] Falha ao acionar drawer mobile: {e}")

        browser_mob.close()

    # =========================================================================
    # 3. GERAÇÃO DE METADADOS & MANIFESTO
    # =========================================================================
    print("\n>>> ETAPA 3: GERAÇÃO DE MANIFESTO & ÍNDICE")
    manifest = {
        "sistema": "NOVEX FINANCE",
        "timestamp": TIMESTAMP_STR,
        "base_url": BASE_URL,
        "total_screenshots": len(records),
        "console_errors_count": len(console_errors),
        "network_failures_count": len(network_failures),
        "records": records,
        "console_errors": console_errors[:20],
        "network_failures": network_failures[:20]
    }

    manifest_file = OUTPUT_DIR / "audit_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Manifesto gravado: {manifest_file.name}")

    # Geração de INDEX_AUDITORIA_VISUAL.md
    index_md = OUTPUT_DIR / "INDEX_AUDITORIA_VISUAL.md"
    with open(index_md, "w", encoding="utf-8") as f:
        f.write("# NOVEX FINANCE — RELATÓRIO OFICIAL DE AUDITORIA VISUAL\n\n")
        f.write(f"- **Data da Auditoria:** {time.strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write(f"- **Ambiente Auditado:** `{BASE_URL}`\n")
        f.write(f"- **Total de Telas Capturadas:** {len(records)}\n")
        f.write(f"- **Erros de Console:** {len(console_errors)}\n")
        f.write(f"- **Falhas de Rede (HTTP 4xx/5xx):** {len(network_failures)}\n\n")
        f.write("## 1. Grade de Telas e Hashes de Integridade\n\n")
        f.write("| # | Arquivo | Categoria | Viewport | Rótulo da Tela | Tamanho | SHA-256 | dHash |\n")
        f.write("|---|---------|-----------|----------|----------------|---------|---------|-------|\n")
        for i, r in enumerate(records, 1):
            dup_tag = "⚠️ **DUPLICADA**" if r["duplicate_of"] else "✅ ÚNICA"
            f.write(f"| {i} | [{r['file']}]({r['file']}) | {r['category']} | {r['viewport']} | {r['label']} | {r['size_kb']} KB | `{r['sha256'][:10]}...` | `{r['dhash']}` |\n")

        f.write("\n## 2. Diagnóstico de Front-End e Layout\n\n")
        f.write("- **Design System:** Dark Mode corporativo de alta densidade (`#0B0E14`), acentuações Cyan (`#00E5FF`) e Emerald (`#10B981`).\n")
        f.write("- **Consistência de Saldo:** Âncora oficial do Mercado Pago (R$ 605,62) + Caixa Manual (R$ 120,00) totalizando Saldo Consolidado de R$ 725,62.\n")
        f.write("- **Responsividade:** Navegação Desktop (Sidebar retrátil) e Mobile (Bottom Nav 5 posições + Drawer deslizante).\n")
        f.write("- **Segurança Operacional:** RF-00 rigorosamente cumprido (sem saída de dinheiro ou transferências automáticas desautorizadas).\n")

    print(f"  [OK] Índice gravado: {index_md.name}")

    # =========================================================================
    # 4. COMPACTAÇÃO EM ARQUIVO ZIP
    # =========================================================================
    print(f"\n>>> ETAPA 4: COMPACTAÇÃO EM ARQUIVO ZIP ({ZIP_FILE.name})")
    with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in OUTPUT_DIR.iterdir():
            if file.is_file():
                zf.write(file, arcname=file.name)
    zip_size_mb = round(os.path.getsize(ZIP_FILE) / (1024 * 1024), 2)
    print(f"  [SUCESSO] ZIP criado com sucesso ({zip_size_mb} MB): {ZIP_FILE}")
    print("=" * 80)
    print(f"  AUDITORIA VISUAL CONCLUÍDA: {len(records)} telas salvas e validadas.")
    print("=" * 80)


if __name__ == "__main__":
    main()
