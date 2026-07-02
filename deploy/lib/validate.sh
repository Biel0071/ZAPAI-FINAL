# ZAPAI Install Library — validate.sh
# Validates that all critical step functions exist in the environment before run.

validate_all_functions_exist() {
  local -A expected_funcs
  expected_funcs=(
    [detect_os]="os.sh"
    [check_requirements]="common.sh"
    [install_packages]="packages.sh"
    [install_node]="node.sh"
    [install_pm2]="pm2.sh"
    [install_postgres]="postgres.sh"
    [configure_postgres]="postgres.sh"
    [install_redis]="redis.sh"
    [install_nginx]="nginx.sh"
    [configure_firewall]="firewall.sh"
    [generate_env]="env.sh"
    [install_backend]="env.sh"
    [run_migrations]="env.sh"
    [build_frontend]="env.sh"
    [configure_nginx]="nginx.sh"
    [configure_pm2]="pm2.sh"
    [health_checks]="health.sh"
    [show_summary]="health.sh"
  )

  local func
  for func in "${!expected_funcs[@]}"; do
    if ! declare -F "$func" >/dev/null 2>&1; then
      echo -e "\n\033[0;31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
      echo -e "\033[0;31m[ERRO CRÍTICO] VALIDAÇÃO DE ARQUITETURA FALHOU!\033[0m"
      echo -e "  Função ausente:   $func"
      echo -e "  Arquivo esperado: lib/${expected_funcs[$func]}"
      echo -e "  Linha:            Verifique a importação do módulo no deploy/install.sh"
      echo -e "\033[0;31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"
      exit 1
    fi
  done
  
  log "✔ Validação de integridade de funções concluída com sucesso (todas as funções existem)!"
}
