/**
 * ESTÉFANY PAIVA NAILS - INTERATIVIDADE & AGENDAMENTO
 * Sistema de Agendamento Automático via WhatsApp
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. MENU MOBILE TOGGLE
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
      }
    });

    // Fechar ao clicar em link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        const icon = mobileToggle.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      });
    });
  }

  // 2. SISTEMA DE AGENDAMENTO DINÂMICO
  const serviceCheckboxes = document.querySelectorAll('.service-checkbox');
  const shapeRadios = document.querySelectorAll('input[name="nail_shape"]');
  const conditionRadios = document.querySelectorAll('input[name="nail_condition"]');
  const bookingDate = document.getElementById('bookingDate');
  const bookingTime = document.getElementById('bookingTime');
  const clientName = document.getElementById('clientName');
  const clientPhone = document.getElementById('clientPhone');

  // Elementos do Resumo
  const sumServices = document.getElementById('sumServices');
  const sumShape = document.getElementById('sumShape');
  const sumDate = document.getElementById('sumDate');
  const sumTime = document.getElementById('sumTime');
  const sumCondition = document.getElementById('sumCondition');
  const sumDuration = document.getElementById('sumDuration');
  const sumTotal = document.getElementById('sumTotal');
  const btnConfirmBooking = document.getElementById('btnConfirmBooking');

  // Definir data mínima como hoje
  if (bookingDate) {
    const today = new Date().toISOString().split('T')[0];
    bookingDate.min = today;
    bookingDate.value = today;
  }

  // Máscara simples para WhatsApp (61) 9XXXX-XXXX
  if (clientPhone) {
    clientPhone.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      }
      e.target.value = v;
    });
  }

  // Função para recalcular o resumo
  function updateBookingSummary() {
    let totalPrice = 0;
    let totalMinutes = 0;
    const selectedServices = [];

    serviceCheckboxes.forEach(cb => {
      const parent = cb.closest('.service-choice-item');
      if (cb.checked) {
        if (parent) parent.classList.add('selected');
        const name = cb.getAttribute('data-name');
        const price = parseFloat(cb.getAttribute('data-price') || 0);
        const duration = parseInt(cb.getAttribute('data-duration') || 0);
        
        selectedServices.push(name);
        totalPrice += price;
        totalMinutes += duration;
      } else {
        if (parent) parent.classList.remove('selected');
      }
    });

    // Formato selecionado
    let selectedShape = 'Amendoada (Padrão)';
    shapeRadios.forEach(radio => {
      if (radio.checked) selectedShape = radio.value;
    });

    // Condição selecionada
    let selectedCondition = 'Unhas naturais sem produto';
    conditionRadios.forEach(radio => {
      if (radio.checked) selectedCondition = radio.value;
    });

    // Atualizar UI
    if (sumServices) {
      sumServices.textContent = selectedServices.length > 0 ? selectedServices.join(', ') : 'Nenhum serviço selecionado';
    }
    if (sumShape) sumShape.textContent = selectedShape;
    if (sumCondition) sumCondition.textContent = selectedCondition;

    // Formatação de data
    if (sumDate && bookingDate && bookingDate.value) {
      const [year, month, day] = bookingDate.value.split('-');
      sumDate.textContent = `${day}/${month}/${year}`;
    }

    // Horário
    if (sumTime && bookingTime) {
      sumTime.textContent = bookingTime.value ? `${bookingTime.value}h` : 'A combinar';
    }

    // Duração
    if (sumDuration) {
      if (totalMinutes === 0) {
        sumDuration.textContent = '1h aprox.';
      } else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        let str = '';
        if (hours > 0) str += `${hours}h `;
        if (mins > 0) str += `${mins}min`;
        sumDuration.textContent = str.trim();
      }
    }

    // Total em R$
    if (sumTotal) {
      sumTotal.textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
    }
  }

  // Ouvir mudanças nos inputs
  serviceCheckboxes.forEach(cb => cb.addEventListener('change', updateBookingSummary));
  shapeRadios.forEach(radio => radio.addEventListener('change', updateBookingSummary));
  conditionRadios.forEach(radio => radio.addEventListener('change', updateBookingSummary));
  if (bookingDate) bookingDate.addEventListener('change', updateBookingSummary);
  if (bookingTime) bookingTime.addEventListener('change', updateBookingSummary);

  // Inicializar cálculo inicial
  updateBookingSummary();

  // Botões de seleção rápida nos cards de serviços
  const quickSelectBtns = document.querySelectorAll('.btn-select-service');
  quickSelectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetServiceId = btn.getAttribute('data-target-service');
      const targetCheckbox = document.getElementById(targetServiceId);
      
      if (targetCheckbox) {
        targetCheckbox.checked = true;
        updateBookingSummary();
        
        // Rolar suavemente até o agendador
        const bookingSection = document.getElementById('agendamento');
        if (bookingSection) {
          bookingSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // 3. ENVIO VIA WHATSAPP (com link do número real 5561985543452)
  if (btnConfirmBooking) {
    btnConfirmBooking.addEventListener('click', () => {
      const name = clientName ? clientName.value.trim() : '';
      const phone = clientPhone ? clientPhone.value.trim() : '';
      
      const selected = Array.from(serviceCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.getAttribute('data-name'));

      if (selected.length === 0) {
        alert('Por favor, selecione pelo menos um serviço para agendar!');
        return;
      }

      if (!name) {
        alert('Por favor, informe seu nome!');
        if (clientName) clientName.focus();
        return;
      }

      let dateFormatted = 'Data a combinar';
      if (bookingDate && bookingDate.value) {
        const [year, month, day] = bookingDate.value.split('-');
        dateFormatted = `${day}/${month}/${year}`;
      }

      const timeChosen = bookingTime ? bookingTime.value : '09:00';
      const shapeChosen = sumShape ? sumShape.textContent : 'Amendoada';
      const conditionChosen = sumCondition ? sumCondition.textContent : 'Unhas Naturais';
      const totalAmount = sumTotal ? sumTotal.textContent : 'R$ 0,00';
      const durationEst = sumDuration ? sumDuration.textContent : '1h';

      // Salvar agendamento no localStorage para o painel administrativo
      const appointmentObj = {
        id: 'AG-' + Math.floor(100 + Math.random() * 900),
        createdAt: new Date().toISOString(),
        clientName: name,
        clientPhone: phone,
        services: selected,
        shape: shapeChosen,
        condition: conditionChosen,
        date: bookingDate && bookingDate.value ? bookingDate.value : new Date().toISOString().split('T')[0],
        time: timeChosen,
        duration: durationEst,
        totalAmount: totalAmount,
        status: 'Pendente'
      };

      try {
        const stored = JSON.parse(localStorage.getItem('estefany_appointments') || '[]');
        stored.unshift(appointmentObj);
        localStorage.setItem('estefany_appointments', JSON.stringify(stored));
      } catch (err) {
        console.error('Erro ao salvar agendamento no localStorage:', err);
      }

      // Montar mensagem elegante para WhatsApp
      const msg = `Olá, Julia! Gostaria de solicitar um agendamento na *Estéfany Paiva Nails* ✨%0A%0A` +
        `👤 *Cliente:* ${encodeURIComponent(name)}%0A` +
        (phone ? `📱 *WhatsApp:* ${encodeURIComponent(phone)}%0A` : '') +
        `💅 *Serviço(s):* ${encodeURIComponent(selected.join(', '))}%0A` +
        `✨ *Formato:* ${encodeURIComponent(shapeChosen)}%0A` +
        `🔍 *Estado atual:* ${encodeURIComponent(conditionChosen)}%0A` +
        `📅 *Data desejada:* ${encodeURIComponent(dateFormatted)}%0A` +
        `⏰ *Horário sugerido:* ${encodeURIComponent(timeChosen + 'h')}%0A` +
        `⏳ *Tempo estimado:* ${encodeURIComponent(durationEst)}%0A` +
        `💰 *Valor estimado:* ${encodeURIComponent(totalAmount)}%0A%0A` +
        `Você tem disponibilidade para esse dia e horário? Aguardo sua confirmação! 💕`;

      const whatsappUrl = `https://wa.me/5561985543452?text=${msg}`;
      window.open(whatsappUrl, '_blank');
    });
  }

  // 4. FILTROS DA GALERIA
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const category = item.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // 5. LIGHTBOX MODAL PARA AS FOTOS
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  if (lightboxModal && lightboxImg) {
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img) {
          lightboxImg.src = img.src;
          lightboxModal.classList.add('active');
        }
      });
    });

    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => {
        lightboxModal.classList.remove('active');
      });
    }

    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) {
        lightboxModal.classList.remove('active');
      }
    });
  }

  // 6. FAQ ACCORDION
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        // Fecha os outros
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
});
