/** UI and message strings. English is the lookup key. */
function row(de, es, fr, pt, ja) {
  return { de, es, fr, pt_BR: pt, ja };
}

module.exports = {
  "← Back": row("← Zurück", "← Atrás", "← Retour", "← Voltar", "← 戻る"),
  "Settings": row("Einstellungen", "Ajustes", "Réglages", "Ajustes", "設定"),
  "StimPad Plus: Not purchased": row("StimPad Plus: Nicht gekauft", "StimPad Plus: Sin comprar", "StimPad Plus : non acheté", "StimPad Plus: não comprado", "StimPad Plus：未購入"),
  "StimPad Plus: Active": row("StimPad Plus: Aktiv", "StimPad Plus: Activo", "StimPad Plus : actif", "StimPad Plus: ativo", "StimPad Plus：有効"),
  "Volume  ·  100%": row("Lautstärke  ·  100 %", "Volumen  ·  100 %", "Volume  ·  100 %", "Volume  ·  100%", "音量  ·  100%"),
  "Volume  ·  %.0f%%": row("Lautstärke  ·  %.0f %%", "Volumen  ·  %.0f %%", "Volume  ·  %.0f %%", "Volume  ·  %.0f%%", "音量  ·  %.0f%%"),
  "App sound level (separate from your phone’s volume buttons).": row(
    "Lautstärke in der App (unabhängig von den Lautstärketasten).",
    "Volumen de la app (aparte de los botones de volumen del teléfono).",
    "Volume de l’app (distinct des boutons du téléphone).",
    "Volume do app (separado dos botões de volume do celular).",
    "アプリ内の音量（本体の音量ボタンとは別です）。"
  ),
  "Repeat Short Sounds": row("Kurze Sounds wiederholen", "Repetir sonidos cortos", "Répéter les sons courts", "Repetir sons curtos", "短い音をリピート"),
  "Keeps replaying short one-shot sounds until you press Stop. Native loop sounds already repeat.": row(
    "Spielt kurze Einzelsounds weiter, bis du auf Stopp tippst. Loop-Sounds wiederholen sich schon von selbst.",
    "Sigue reproduciendo los sonidos cortos hasta que pulses Detener. Los loops ya se repiten solos.",
    "Rejoue les sons courts jusqu’à Stop. Les boucles se répètent déjà toutes seules.",
    "Continua os sons curtos até você tocar em Parar. Os loops já se repetem sozinhos.",
    "短い単発音を、停止するまで繰り返します。ループ音は最初から繰り返されます。"
  ),
  "Head Flossing": row("Stereo-Schwenk", "Balanceo estéreo", "Balayage stéréo", "Varredura estéreo", "ステレオパン"),
  "Gently pans sound left ↔ right in headphones (~every few seconds). Applies to all sounds while playing.": row(
    "Schwenkt den Klang sanft links ↔ rechts in Kopfhörern (etwa alle paar Sekunden). Gilt für alle Sounds während der Wiedergabe.",
    "Mueve el sonido suavemente de izquierda ↔ derecha en los auriculares (cada pocos segundos). Vale para todos los sonidos.",
    "Fait glisser le son doucement gauche ↔ droite dans le casque (toutes les quelques secondes). S’applique à tous les sons.",
    "Move o som suavemente da esquerda ↔ direita no fone (a cada poucos segundos). Vale para todos os sons.",
    "ヘッドホンで音を左右にゆっくり動かします（数秒ごと）。再生中のすべての音に適用されます。"
  ),
  "Haptic Feedback": row("Vibration", "Respuesta háptica", "Retour haptique", "Resposta tátil", "触覚フィードバック"),
  "Short vibration when you tap sounds or play.": row(
    "Kurze Vibration, wenn du Sounds antippst oder abspielst.",
    "Una vibración breve al tocar o reproducir sonidos.",
    "Courte vibration quand vous touchez un son ou lancez la lecture.",
    "Uma vibração curta ao tocar ou reproduzir sons.",
    "音をタップしたときや再生時に、短く振動します。"
  ),
  "Show Pitch & Speed": row("Tonhöhe & Tempo anzeigen", "Mostrar tono y velocidad", "Afficher hauteur et vitesse", "Mostrar tom e velocidade", "音程と速度を表示"),
  "Adds a slider on each sound page. Lower = deeper and slower.": row(
    "Zeigt auf jeder Sound-Seite einen Regler. Niedriger = tiefer und langsamer.",
    "Añade un control en cada sonido. Más bajo = más grave y más lento.",
    "Ajoute un curseur sur chaque son. Plus bas = plus grave et plus lent.",
    "Adiciona um controle em cada som. Mais baixo = mais grave e mais lento.",
    "各サウンド画面にスライダーを追加します。下げると低く、遅くなります。"
  ),
  "Tap Ripples": row("Tipp-Wellen", "Ondas al tocar", "Ondes au toucher", "Ondas ao tocar", "タップの波紋"),
  "Soft expanding ripples where you tap (optional visual stim).": row(
    "Sanfte Wellen dort, wo du tippst (optionaler visueller Stim).",
    "Ondas suaves donde tocas (estímulo visual opcional).",
    "Ondes douces là où vous touchez (stim visuel facultatif).",
    "Ondas suaves onde você toca (estímulo visual opcional).",
    "タップした場所に広がる柔らかい波紋（任意の視覚刺激）。"
  ),
  "Restore Purchases": row("Käufe wiederherstellen", "Restaurar compras", "Restaurer les achats", "Restaurar compras", "購入を復元"),
  "Privacy Policy": row("Datenschutz", "Política de privacidad", "Politique de confidentialité", "Política de privacidade", "プライバシーポリシー"),
  "Feedback": row("Feedback", "Comentarios", "Avis", "Feedback", "フィードバック"),
  "Rate StimPad": row("StimPad bewerten", "Valorar StimPad", "Noter StimPad", "Avaliar o StimPad", "StimPadを評価"),
  "Manage Ad Consent": row("Werbe-Einwilligung", "Gestionar consentimiento de anuncios", "Gérer le consentement pub", "Gerenciar consentimento de anúncios", "広告の同意を管理"),
  "StimPad v%s": row("StimPad v%s", "StimPad v%s", "StimPad v%s", "StimPad v%s", "StimPad v%s"),
  "StimPad v1.0.0": row("StimPad v1.0.0", "StimPad v1.0.0", "StimPad v1.0.0", "StimPad v1.0.0", "StimPad v1.0.0"),
  "Tip: Head Flossing, haptics & more live in Settings.": row(
    "Tipp: Stereo-Schwenk, Vibration und mehr findest du in den Einstellungen.",
    "Consejo: el balanceo estéreo, la vibración y más están en Ajustes.",
    "Astuce : balayage stéréo, vibrations et plus sont dans Réglages.",
    "Dica: varredura estéreo, vibração e mais estão em Ajustes.",
    "ヒント：ステレオパンや振動などは設定にあります。"
  ),
  "Dismiss": row("Schließen", "Cerrar", "Fermer", "Fechar", "閉じる"),
  "No favorites yet.\nTap the heart on a sound to save it here.": row(
    "Noch keine Favoriten.\nTippe auf das Herz bei einem Sound, um ihn hier zu speichern.",
    "Aún no hay favoritos.\nToca el corazón de un sonido para guardarlo aquí.",
    "Pas encore de favoris.\nTouchez le cœur d’un son pour l’enregistrer ici.",
    "Ainda não há favoritos.\nToque no coração de um som para salvá-lo aqui.",
    "お気に入りはまだありません。\n音のハートをタップすると、ここに保存されます。"
  ),
  "No recent sounds yet.\nPlay something and it will show up here.": row(
    "Noch keine zuletzt gespielten Sounds.\nSpiel etwas ab, dann erscheint es hier.",
    "Aún no hay sonidos recientes.\nReproduce algo y aparecerá aquí.",
    "Pas encore de sons récents.\nLancez-en un et il apparaîtra ici.",
    "Ainda não há sons recentes.\nToque algo e ele aparece aqui.",
    "最近の音はまだありません。\n再生すると、ここに表示されます。"
  ),
  "No free sounds in this category.": row(
    "Keine kostenlosen Sounds in dieser Kategorie.",
    "No hay sonidos gratis en esta categoría.",
    "Aucun son gratuit dans cette catégorie.",
    "Não há sons grátis nesta categoria.",
    "このカテゴリに無料の音はありません。"
  ),
  "No sounds in this filter.": row(
    "Keine Sounds in diesem Filter.",
    "No hay sonidos en este filtro.",
    "Aucun son dans ce filtre.",
    "Não há sons neste filtro.",
    "このフィルターに音はありません。"
  ),
  "Are you enjoying StimPad?": row(
    "Gefällt dir StimPad?",
    "¿Te está gustando StimPad?",
    "Vous aimez StimPad ?",
    "Está gostando do StimPad?",
    "StimPadを楽しんでいますか？"
  ),
  "A quick check-in helps us keep the sounds calm, useful, and fun.": row(
    "Eine kurze Rückmeldung hilft uns, die Sounds ruhig, nützlich und schön zu halten.",
    "Una respuesta rápida nos ayuda a mantener los sonidos tranquilos, útiles y agradables.",
    "Un petit mot nous aide à garder des sons calmes, utiles et agréables.",
    "Uma resposta rápida nos ajuda a manter os sons calmos, úteis e gostosos.",
    "ひとこともらえると、音を落ち着いて、役に立って、楽しく保てます。"
  ),
  "Yes — I am": row("Ja", "Sí", "Oui", "Sim", "はい"),
  "Not really": row("Eher nicht", "No mucho", "Pas vraiment", "Nem tanto", "あまり"),
  "Tip": row("Tipp", "Consejo", "Astuce", "Dica", "ヒント"),
  "Open Settings": row("Einstellungen öffnen", "Abrir Ajustes", "Ouvrir Réglages", "Abrir Ajustes", "設定を開く"),
  "Got it": row("Verstanden", "Entendido", "Compris", "Entendi", "わかった"),
  "Try Head Flossing": row("Stereo-Schwenk ausprobieren", "Prueba el balanceo estéreo", "Essayez le balayage stéréo", "Experimente a varredura estéreo", "ステレオパンを試す"),
  "In Settings, turn on Head Flossing to gently pan sounds left ↔ right in headphones.": row(
    "Aktiviere in den Einstellungen den Stereo-Schwenk, damit Sounds im Kopfhörer sanft links ↔ rechts wandern.",
    "En Ajustes, activa el balanceo estéreo para mover los sonidos suavemente de izquierda ↔ derecha en los auriculares.",
    "Dans Réglages, activez le balayage stéréo pour faire glisser les sons gauche ↔ droite dans le casque.",
    "Em Ajustes, ative a varredura estéreo para mover os sons suavemente da esquerda ↔ direita no fone.",
    "設定でステレオパンをオンにすると、ヘッドホンで音が左右にゆっくり動きます。"
  ),
  "Feel the taps": row("Taps spüren", "Siente los toques", "Ressentez les touches", "Sinta os toques", "タップを感じる"),
  "Haptic feedback vibrates your phone when you tap sounds. Toggle it anytime in Settings.": row(
    "Die Vibration lässt das Telefon kurz zittern, wenn du Sounds antippst. Du kannst sie jederzeit in den Einstellungen ändern.",
    "La vibración hace temblar el teléfono al tocar sonidos. Puedes cambiarla cuando quieras en Ajustes.",
    "La vibration fait frémir le téléphone quand vous touchez un son. Vous pouvez la changer dans Réglages.",
    "A vibração faz o celular tremer ao tocar nos sons. Você pode mudar isso quando quiser em Ajustes.",
    "触覚フィードバックは、音をタップしたときにスマホを振動させます。設定でいつでも切り替えられます。"
  ),
  "Tune pitch & speed": row("Tonhöhe & Tempo", "Ajusta tono y velocidad", "Réglez hauteur et vitesse", "Ajuste tom e velocidade", "音程と速度を調整"),
  "Enable Pitch & Speed in Settings to show a slider on each sound — deepen high clicks or slow loops.": row(
    "Aktiviere Tonhöhe & Tempo in den Einstellungen, dann erscheint bei jedem Sound ein Regler — für tiefere Klicks oder langsamere Loops.",
    "Activa Tono y velocidad en Ajustes para ver un control en cada sonido: graves más profundos o loops más lentos.",
    "Activez Hauteur et vitesse dans Réglages pour un curseur sur chaque son — clics plus graves ou boucles plus lentes.",
    "Ative Tom e velocidade em Ajustes para ver um controle em cada som — cliques mais graves ou loops mais lentos.",
    "設定で音程と速度をオンにすると、各サウンドにスライダーが出ます。高いクリックを低く、ループを遅くできます。"
  ),
  "Tap ripples": row("Tipp-Wellen", "Ondas al tocar", "Ondes au toucher", "Ondas ao tocar", "タップの波紋"),
  "Want a soft visual burst when you tap? Turn on Tap Ripples in Settings.": row(
    "Möchtest du beim Tippen einen sanften visuellen Impuls? Aktiviere Tipp-Wellen in den Einstellungen.",
    "¿Quieres un destello suave al tocar? Activa Ondas al tocar en Ajustes.",
    "Envie d’un éclat doux quand vous touchez ? Activez Ondes au toucher dans Réglages.",
    "Quer um brilho suave ao tocar? Ative Ondas ao tocar em Ajustes.",
    "タップしたときに柔らかい光が欲しいときは、設定でタップの波紋をオンにしてください。"
  ),
  "Sound": row("Sound", "Sonido", "Son", "Som", "サウンド"),
  "Playing": row("Wiedergabe", "Reproduciendo", "Lecture", "Reproduzindo", "再生中"),
  "this sound": row("diesem Sound", "este sonido", "ce son", "este som", "この音"),
  "Play": row("Abspielen", "Reproducir", "Lire", "Reproduzir", "再生"),
  "Stop": row("Stopp", "Detener", "Stop", "Parar", "停止"),
  "Add to favorites": row("Zu Favoriten", "Añadir a favoritos", "Ajouter aux favoris", "Adicionar aos favoritos", "お気に入りに追加"),
  "Remove favorite": row("Favorit entfernen", "Quitar de favoritos", "Retirer des favoris", "Remover dos favoritos", "お気に入りから外す"),
  "Repeat  Off": row("Wiederholen  Aus", "Repetir  No", "Répéter  Non", "Repetir  Não", "リピート  オフ"),
  "Repeat  On": row("Wiederholen  An", "Repetir  Sí", "Répéter  Oui", "Repetir  Sim", "リピート  オン"),
  "Replay short sounds until you stop": row(
    "Kurze Sounds wiederholen, bis du stoppst",
    "Repite sonidos cortos hasta que pares",
    "Rejoue les sons courts jusqu’à l’arrêt",
    "Repete sons curtos até você parar",
    "停止するまで短い音を繰り返します"
  ),
  "Short sounds keep replaying until you stop": row(
    "Kurze Sounds laufen weiter, bis du stoppst",
    "Los sonidos cortos siguen hasta que pares",
    "Les sons courts continuent jusqu’à l’arrêt",
    "Os sons curtos continuam até você parar",
    "短い音は停止するまで続きます"
  ),
  "Turn on to replay short sounds automatically": row(
    "Einschalten, damit kurze Sounds automatisch weiterlaufen",
    "Actívalo para repetir los sonidos cortos",
    "Activez pour rejouer les sons courts",
    "Ative para repetir os sons curtos",
    "オンにすると短い音を自動で繰り返します"
  ),
  "Pitch & Speed  ·  100%": row("Tonhöhe & Tempo  ·  100 %", "Tono y velocidad  ·  100 %", "Hauteur et vitesse  ·  100 %", "Tom e velocidade  ·  100%", "音程と速度  ·  100%"),
  "Pitch & Speed  ·  %.0f%%": row("Tonhöhe & Tempo  ·  %.0f %%", "Tono y velocidad  ·  %.0f %%", "Hauteur et vitesse  ·  %.0f %%", "Tom e velocidade  ·  %.0f%%", "音程と速度  ·  %.0f%%"),
  "Until I stop": row("Bis ich stoppe", "Hasta que pare", "Jusqu’à l’arrêt", "Até eu parar", "停止するまで"),
  "15 min": row("15 Min.", "15 min", "15 min", "15 min", "15分"),
  "30 min": row("30 Min.", "30 min", "30 min", "30 min", "30分"),
  "60 min": row("60 Min.", "60 min", "60 min", "60 min", "60分"),
  "Open %s": row("%s öffnen", "Abrir %s", "Ouvrir %s", "Abrir %s", "%sを開く"),
  "Tap to unlock": row("Tippen zum Freischalten", "Toca para desbloquear", "Touchez pour débloquer", "Toque para desbloquear", "タップして解除"),
  "All": row("Alle", "Todo", "Tout", "Tudo", "すべて"),
  "Free": row("Gratis", "Gratis", "Gratuit", "Grátis", "無料"),
  "Favorites": row("Favoriten", "Favoritos", "Favoris", "Favoritos", "お気に入り"),
  "Recent": row("Zuletzt", "Recientes", "Récents", "Recentes", "最近"),
  "All categories": row("Alle Kategorien", "Todas las categorías", "Toutes les catégories", "Todas as categorias", "すべてのカテゴリ"),
  "Alarms": row("Alarme", "Alarmas", "Alarmes", "Alarmes", "警報"),
  "Bells": row("Glocken", "Campanas", "Cloches", "Sinos", "ベル"),
  "Household": row("Haushalt", "Hogar", "Maison", "Casa", "家庭"),
  "Clicks": row("Klicks", "Clics", "Clics", "Cliques", "クリック"),
  "Vehicles": row("Fahrzeuge", "Vehículos", "Véhicules", "Veículos", "乗り物"),
  "Water": row("Wasser", "Agua", "Eau", "Água", "水"),
  "Noise": row("Rauschen", "Ruido", "Bruit", "Ruído", "ノイズ"),
  "Nature": row("Natur", "Naturaleza", "Nature", "Natureza", "自然"),
  "Animals": row("Tiere", "Animales", "Animaux", "Animais", "動物"),
  "Tools": row("Werkzeuge", "Herramientas", "Outils", "Ferramentas", "工具"),
  "Retro": row("Retro", "Retro", "Rétro", "Retrô", "レトロ"),
  "Misc": row("Sonstiges", "Varios", "Divers", "Outros", "その他"),
  "StimPad Plus": row("StimPad Plus", "StimPad Plus", "StimPad Plus", "StimPad Plus", "StimPad Plus"),
  "All sounds · No ads · One purchase": row(
    "Alle Sounds · Keine Werbung · Einmal kaufen",
    "Todos los sonidos · Sin anuncios · Una compra",
    "Tous les sons · Sans pub · Un achat",
    "Todos os sons · Sem anúncios · Uma compra",
    "すべての音 · 広告なし · 1回の購入"
  ),
  "Unlock all": row("Alles frei", "Desbloquear todo", "Tout débloquer", "Desbloquear tudo", "すべて解除"),
  "No ads": row("Keine Werbung", "Sin anuncios", "Sans pub", "Sem anúncios", "広告なし"),
  "Full library": row("Ganze Bibliothek", "Biblioteca completa", "Bibliothèque complète", "Biblioteca completa", "全ライブラリ"),
  "Unlock 70+ stim sounds and remove ads.": row(
    "Schalte über 70 Stim-Sounds frei und entferne die Werbung.",
    "Desbloquea más de 70 sonidos stim y quita los anuncios.",
    "Débloquez plus de 70 sons stim et retirez les pubs.",
    "Desbloqueie mais de 70 sons stim e remova os anúncios.",
    "70以上の刺激音を解除して、広告を消します。"
  ),
  "Unlock until midnight": row("Bis Mitternacht frei", "Desbloqueado hasta medianoche", "Débloqué jusqu’à minuit", "Desbloqueado até meia-noite", "深夜0時まで解除"),
  "$4.99 · one-time": row("4,99 $ · einmalig", "4,99 $ · un solo pago", "4,99 $ · une fois", "US$ 4,99 · único", "$4.99 · 1回"),
  "%s · one-time": row("%s · einmalig", "%s · un solo pago", "%s · une fois", "%s · único", "%s · 1回"),
  "You're all set": row("Alles bereit", "Todo listo", "C’est prêt", "Tudo pronto", "準備できました"),
  "You have StimPad Plus. All sounds unlocked, ads removed.": row(
    "Du hast StimPad Plus. Alle Sounds sind frei, die Werbung ist weg.",
    "Tienes StimPad Plus. Todos los sonidos están libres y no hay anuncios.",
    "Vous avez StimPad Plus. Tous les sons sont débloqués, sans pub.",
    "Você tem o StimPad Plus. Todos os sons estão livres, sem anúncios.",
    "StimPad Plusを利用中です。すべての音が解除され、広告はありません。"
  ),
  "Owned": row("Gekauft", "Comprado", "Acheté", "Comprado", "購入済み"),
  "Unlock \"%s\" or go Plus": row("„%s“ freischalten oder Plus holen", "Desbloquea «%s» o pasa a Plus", "Débloquez « %s » ou passez à Plus", "Desbloqueie “%s” ou assine o Plus", "「%s」を解除するか Plus にする"),
  "%s unlocked until midnight. Buy Plus for everything, no ads.": row(
    "%s ist bis Mitternacht frei. Hol Plus für alles, ohne Werbung.",
    "%s está libre hasta medianoche. Compra Plus para todo, sin anuncios.",
    "%s est débloqué jusqu’à minuit. Prenez Plus pour tout, sans pub.",
    "%s está livre até meia-noite. Compre o Plus para tudo, sem anúncios.",
    "%s は深夜0時まで解除されています。Plus ですべて、広告なし。"
  ),
  "Watch an ad for today, or unlock everything with Plus.": row(
    "Schau eine Werbung für heute, oder schalte mit Plus alles frei.",
    "Mira un anuncio para hoy, o desbloquea todo con Plus.",
    "Regardez une pub pour aujourd’hui, ou débloquez tout avec Plus.",
    "Assista a um anúncio para hoje, ou desbloqueie tudo com o Plus.",
    "今日だけ広告を見るか、Plus ですべて解除します。"
  ),
  "Loading ad…": row("Werbung wird geladen…", "Cargando anuncio…", "Chargement de la pub…", "Carregando anúncio…", "広告を読み込み中…"),
  "No purchases found to restore.": row(
    "Keine Käufe zum Wiederherstellen gefunden.",
    "No hay compras para restaurar.",
    "Aucun achat à restaurer.",
    "Não há compras para restaurar.",
    "復元できる購入が見つかりません。"
  ),
  "Purchase restored.": row("Kauf wiederhergestellt.", "Compra restaurada.", "Achat restauré.", "Compra restaurada.", "購入を復元しました。"),
  "Purchase failed: %s": row("Kauf fehlgeschlagen: %s", "La compra falló: %s", "Achat échoué : %s", "A compra falhou: %s", "購入に失敗しました：%s"),
  "Purchase failed": row("Kauf fehlgeschlagen", "La compra falló", "Achat échoué", "A compra falhou", "購入に失敗しました"),
  "Purchase canceled": row("Kauf abgebrochen", "Compra cancelada", "Achat annulé", "Compra cancelada", "購入をキャンセルしました"),
  "App Store not ready yet": row("App Store ist noch nicht bereit", "App Store aún no está listo", "L’App Store n’est pas encore prêt", "A App Store ainda não está pronta", "App Storeの準備ができていません"),
  "Product unavailable in App Store": row("Produkt im App Store nicht verfügbar", "Producto no disponible en App Store", "Produit indisponible sur l’App Store", "Produto indisponível na App Store", "App Storeでこの商品は利用できません"),
  "Store not ready": row("Store ist nicht bereit", "La tienda no está lista", "La boutique n’est pas prête", "A loja não está pronta", "ストアの準備ができていません"),
  "Store not available": row("Store nicht verfügbar", "Tienda no disponible", "Boutique indisponible", "Loja indisponível", "ストアを利用できません"),
  "IAP not linked for this platform yet": row(
    "Käufe sind auf dieser Plattform noch nicht verbunden.",
    "Las compras aún no están conectadas en esta plataforma.",
    "Les achats ne sont pas encore liés sur cette plateforme.",
    "As compras ainda não estão ligadas nesta plataforma.",
    "このプラットフォームでは購入がまだ接続されていません。"
  ),
  "Restore not supported": row("Wiederherstellen nicht möglich", "Restaurar no está disponible", "Restauration non prise en charge", "Restaurar não é suportado", "復元には対応していません"),
  "Unknown product": row("Unbekanntes Produkt", "Producto desconocido", "Produit inconnu", "Produto desconhecido", "不明な商品"),
  "What’s working, broken, or missing — we’d love to know.": row(
    "Was funktioniert, fehlt oder hakt — wir möchten es wissen.",
    "Qué funciona, falla o falta: nos encantaría saberlo.",
    "Ce qui marche, casse ou manque — dites-le-nous.",
    "O que funciona, quebra ou falta — queremos saber.",
    "うまくいくこと、壊れていること、足りないこと。教えてください。"
  ),
  "OS": row("System", "Sistema", "Système", "Sistema", "OS"),
  "Version / build": row("Version / Build", "Versión / compilación", "Version / build", "Versão / build", "バージョン / ビルド"),
  "Your feedback": row("Dein Feedback", "Tus comentarios", "Votre avis", "Seu feedback", "フィードバック"),
  "What can we improve?": row("Was können wir verbessern?", "¿Qué podemos mejorar?", "Que peut-on améliorer ?", "O que podemos melhorar?", "どこを良くできますか？"),
  "Email (optional)": row("E-Mail (optional)", "Correo (opcional)", "E-mail (facultatif)", "E-mail (opcional)", "メール（任意）"),
  "you@example.com": row("du@example.com", "tu@example.com", "vous@example.com", "voce@example.com", "you@example.com"),
  "Sounds to add (optional)": row("Sounds zum Hinzufügen (optional)", "Sonidos para añadir (opcional)", "Sons à ajouter (facultatif)", "Sons para adicionar (opcional)", "追加してほしい音（任意）"),
  "e.g. fridge door, keyboard ASMR…": row(
    "z. B. Kühlschranktür, Tastatur-ASMR…",
    "p. ej. puerta de la nevera, ASMR de teclado…",
    "p. ex. porte du frigo, ASMR clavier…",
    "ex.: porta da geladeira, ASMR de teclado…",
    "例：冷蔵庫のドア、キーボードASMR…"
  ),
  "Send feedback": row("Feedback senden", "Enviar comentarios", "Envoyer", "Enviar feedback", "送信"),
  "Sending…": row("Wird gesendet…", "Enviando…", "Envoi…", "Enviando…", "送信中…"),
  "Already sending…": row("Wird schon gesendet…", "Ya se está enviando…", "Envoi déjà en cours…", "Já está enviando…", "すでに送信中です…"),
  "Please enter some feedback.": row("Bitte schreib etwas Feedback.", "Escribe algún comentario.", "Écrivez un avis.", "Escreva um feedback.", "フィードバックを入力してください。"),
  "Could not start request (%s).": row("Anfrage konnte nicht starten (%s).", "No se pudo iniciar la solicitud (%s).", "Impossible de lancer la requête (%s).", "Não foi possível iniciar o pedido (%s).", "リクエストを開始できませんでした（%s）。"),
  "Something went wrong. Please try again.": row("Etwas ist schiefgelaufen. Bitte noch einmal versuchen.", "Algo salió mal. Inténtalo de nuevo.", "Un problème est survenu. Réessayez.", "Algo deu errado. Tente de novo.", "問題が起きました。もう一度お試しください。"),
  "Thanks — your feedback was sent.": row("Danke — dein Feedback ist raus.", "Gracias, tus comentarios se enviaron.", "Merci — votre avis a été envoyé.", "Obrigado — seu feedback foi enviado.", "ありがとう。フィードバックを送信しました。"),
  "Send failed (HTTP %d).": row("Senden fehlgeschlagen (HTTP %d).", "Error al enviar (HTTP %d).", "Échec de l’envoi (HTTP %d).", "Falha ao enviar (HTTP %d).", "送信に失敗しました（HTTP %d）。"),
  "No sound selected.": row("Kein Sound ausgewählt.", "Ningún sonido seleccionado.", "Aucun son sélectionné.", "Nenhum som selecionado.", "音が選ばれていません。"),
  "Stop playback first.": row("Stoppe zuerst die Wiedergabe.", "Detén primero la reproducción.", "Arrêtez d’abord la lecture.", "Pare a reprodução primeiro.", "先に再生を停止してください。"),
  "Ads aren't ready yet — try again in a moment.": row(
    "Werbung ist noch nicht bereit — gleich noch einmal versuchen.",
    "Los anuncios aún no están listos. Prueba en un momento.",
    "Les pubs ne sont pas encore prêtes — réessayez dans un instant.",
    "Os anúncios ainda não estão prontos — tente de novo em instantes.",
    "広告の準備ができていません。少ししてからもう一度。"
  ),
  "Ad is still loading — try again in a moment.": row(
    "Die Werbung lädt noch — gleich noch einmal versuchen.",
    "El anuncio aún se carga. Prueba en un momento.",
    "La pub charge encore — réessayez dans un instant.",
    "O anúncio ainda está carregando — tente de novo em instantes.",
    "広告を読み込み中です。少ししてからもう一度。"
  ),
  "No ad available right now — try again in a bit.": row(
    "Gerade keine Werbung da — später noch einmal versuchen.",
    "No hay anuncio ahora. Prueba un poco más tarde.",
    "Pas de pub pour le moment — réessayez bientôt.",
    "Não há anúncio agora — tente de novo daqui a pouco.",
    "今は広告がありません。少しあとでもう一度。"
  ),
  "Watch the full ad to unlock.": row(
    "Schau die Werbung ganz, um freizuschalten.",
    "Mira el anuncio entero para desbloquear.",
    "Regardez toute la pub pour débloquer.",
    "Assista ao anúncio inteiro para desbloquear.",
    "解除するには広告を最後まで見てください。"
  ),
  "Couldn't show the ad. Try again.": row(
    "Die Werbung konnte nicht gezeigt werden. Bitte noch einmal.",
    "No se pudo mostrar el anuncio. Inténtalo de nuevo.",
    "Impossible d’afficher la pub. Réessayez.",
    "Não foi possível mostrar o anúncio. Tente de novo.",
    "広告を表示できませんでした。もう一度お試しください。"
  ),
  "StimPad uses this to show more relevant ads on the free tier. You can change this anytime in Settings.": row(
    "StimPad nutzt das, um in der Gratis-Version passendere Werbung zu zeigen. Du kannst das jederzeit in den Einstellungen ändern.",
    "StimPad usa esto para mostrar anuncios más relevantes en la versión gratis. Puedes cambiarlo cuando quieras en Ajustes.",
    "StimPad s’en sert pour des pubs plus pertinentes dans la version gratuite. Vous pouvez changer cela dans Réglages.",
    "O StimPad usa isso para mostrar anúncios mais relevantes na versão grátis. Você pode mudar isso quando quiser em Ajustes.",
    "StimPadは無料版でより関連する広告を表示するためにこれを使います。設定でいつでも変更できます。"
  ),
  "Ad banner area": row("Werbefläche", "Zona de anuncio", "Zone de pub", "Área do anúncio", "広告エリア"),
  "Ad banner area (preview)": row("Werbefläche (Vorschau)", "Zona de anuncio (vista previa)", "Zone de pub (aperçu)", "Área do anúncio (prévia)", "広告エリア（プレビュー）"),
};
