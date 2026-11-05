/**
 * UMS SMART GROWTH HUB — Interactive Single Page Application Client
 * Manages 3-Role Navigation (Student, Teacher, Parent), Chart.js Competency Radar,
 * Project Vault submission, Teacher Rubric grading & report editor, and 24/7 AI Companion.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global Application State
  const state = {
    currentRole: "student",
    currentStudentId: "UMS-8A1-012",
    currentStudent: null,
    students: [],
    projects: [],
    radarChart: null,
    currentReport: null,
    currentGradingProject: null,
  };

  // DOM Elements
  const roleButtons = document.querySelectorAll(".role-btn");
  const viewSections = {
    student: document.getElementById("student-view"),
    teacher: document.getElementById("teacher-view"),
    parent: document.getElementById("parent-view"),
  };
  const personaSelect = document.getElementById("persona-select");

  // =========================================================================
  // 1. INITIALIZATION & DATA LOADING
  // =========================================================================

  async function initApp() {
    setupRoleSwitcher();
    setupSubTabs();
    setupPersonaSelector();
    setupSubmissionModal();
    setupTeacherWorkspace();
    setupParentChatbot();

    await loadStudents();
    await loadCurrentStudentData();
  }

  async function loadStudents() {
    try {
      const resp = await fetch("/api/students");
      if (resp.ok) {
        state.students = await resp.json();
        populateStudentSelects();
      }
    } catch (err) {
      console.error("Error loading students:", err);
    }
  }

  function populateStudentSelects() {
    // Populate report student select in teacher tab
    const reportSelect = document.getElementById("report-student-select");
    if (reportSelect && state.students.length > 0) {
      reportSelect.innerHTML = state.students
        .map(s => `<option value="${s.id}">${s.full_name} (${s.class_name || s.grade})</option>`)
        .join("");
    }
  }

  async function loadCurrentStudentData() {
    try {
      const resp = await fetch(`/api/students/${state.currentStudentId}`);
      if (resp.ok) {
        state.currentStudent = await resp.json();
        renderStudentHero();
        await loadStudentProjects();
        await renderRadarChart();
        renderDigitalPassport();
        renderParentTimeline();
      }
    } catch (err) {
      console.error("Error loading current student:", err);
    }
  }

  // =========================================================================
  // 2. ROLE SWITCHER & SUB-TABS
  // =========================================================================

  function setupRoleSwitcher() {
    roleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetRole = btn.dataset.role;
        switchRole(targetRole);
      });
    });
  }

  function switchRole(role) {
    state.currentRole = role;

    // Update button active state
    roleButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.role === role);
    });

    // Show corresponding section
    Object.keys(viewSections).forEach(key => {
      if (viewSections[key]) {
        viewSections[key].classList.toggle("active", key === role);
      }
    });

    // Refresh view specific components
    if (role === "student") {
      if (state.radarChart) {
        state.radarChart.resize();
      }
    } else if (role === "teacher") {
      renderTeacherRoster();
      loadTeacherGradingProjects();
    } else if (role === "parent") {
      renderParentTimeline();
    }
  }

  function setupSubTabs() {
    document.querySelectorAll(".sub-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const parentSection = btn.closest(".view-section");
        if (!parentSection) return;

        // Deactivate siblings
        parentSection.querySelectorAll(".sub-tab-btn").forEach(b => b.classList.remove("active"));
        parentSection.querySelectorAll(".sub-tab-content").forEach(c => c.style.display = "none");

        // Activate target
        btn.classList.add("active");
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.style.display = "block";
          if (targetId === "tab-radar" && state.radarChart) {
            state.radarChart.resize();
          }
        }
      });
    });
  }

  function setupPersonaSelector() {
    if (!personaSelect) return;
    personaSelect.addEventListener("change", async (e) => {
      state.currentStudentId = e.target.value;
      await loadCurrentStudentData();
    });
  }

  // =========================================================================
  // 3. STUDENT VIEW: HERO, VAULT, RADAR, PASSPORT
  // =========================================================================

  function renderStudentHero() {
    const s = state.currentStudent;
    if (!s) return;

    const nameEl = document.getElementById("student-name");
    const avatarEl = document.getElementById("student-avatar");
    const codeEl = document.getElementById("student-code-badge");
    const classEl = document.getElementById("student-class-badge");
    const targetEl = document.getElementById("student-target");
    const gpaEl = document.getElementById("student-gpa");
    const cefrEl = document.getElementById("student-cefr");
    const clubsEl = document.getElementById("student-clubs");
    const teacherEl = document.getElementById("student-teacher");

    if (nameEl) nameEl.textContent = s.full_name;
    if (avatarEl) {
      const initials = s.full_name.split(" ").map(w => w[0]).slice(-2).join("");
      avatarEl.textContent = initials || "UMS";
    }
    if (codeEl) codeEl.textContent = `Mã: ${s.student_code || s.id}`;
    if (classEl) classEl.textContent = `Lớp ${s.class_name} (Khối ${s.grade})`;
    if (targetEl) targetEl.textContent = `Mục tiêu: ${s.target_highschool || "THPT Chuyên Ngoại ngữ (CNN)"}`;
    if (gpaEl) gpaEl.innerHTML = `GPA: <b>${s.gpa}/10</b>`;
    if (cefrEl) cefrEl.innerHTML = `CEFR: <b>${s.cefr_level || "B2"}</b>`;
    if (clubsEl) clubsEl.innerHTML = `CLB: <b>${(s.clubs || []).join(", ") || "Học thuật"}</b>`;
    if (teacherEl) teacherEl.innerHTML = `GVCN: <b>${s.homeroom_teacher_name || "Cô Đỗ Tuệ Uyên"}</b>`;
  }

  async function loadStudentProjects() {
    try {
      const resp = await fetch(`/api/projects?student_id=${state.currentStudentId}`);
      if (resp.ok) {
        state.projects = await resp.json();
        renderProjectsVault(state.projects);
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  }

  function renderProjectsVault(projects) {
    const listEl = document.getElementById("vault-projects-list");
    if (!listEl) return;

    if (!projects || projects.length === 0) {
      listEl.innerHTML = `
        <div class="glass-panel card-body" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <p style="font-size: 1.1rem; font-weight: 600;">Chưa có bài nộp dự án nào trong kho.</p>
          <p style="font-size: 0.85rem; margin-top: 0.5rem;">Hãy bấm nút <b>"Nộp dự án mới"</b> để bắt đầu số hóa minh chứng năng lực của em!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = projects.map(p => {
      const score = p.score || (p.rubric_evaluation && p.rubric_evaluation.total_score);
      const scoreHtml = score
        ? `<span class="score-badge ${score >= 9.0 ? 'score-high' : 'score-med'}">${score.toFixed(1)} / 10.0</span>`
        : `<span class="skill-badge">Đang duyệt</span>`;

      const tags = (p.rubric_evaluation && p.rubric_evaluation.skills)
        ? p.rubric_evaluation.skills.map(sk => `<span class="skill-badge">${sk.skill_name || sk.name}</span>`).join("")
        : (p.skills || []).map(sk => `<span class="skill-badge">${sk}</span>`).join("");

      return `
        <div class="project-card">
          <div class="project-card-header">
            <div>
              <span class="skill-badge gold">${p.category || 'Liên môn'}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">
                ${p.submitted_at ? p.submitted_at.slice(0, 10) : '2026-03-15'}
              </span>
              <h4 class="project-title" style="margin-top: 0.35rem;">${p.title}</h4>
            </div>
            ${scoreHtml}
          </div>
          <p class="project-desc">${p.content_text || p.content ? (p.content_text || p.content).slice(0, 220) + '...' : ''}</p>
          ${p.reflection ? `<p style="font-size: 0.8rem; font-style: italic; color: #475569; margin-bottom: 0.5rem; background: #f8fafc; padding: 0.4rem 0.6rem; border-left: 2px solid var(--accent-gold);">Phản tư: "${p.reflection.slice(0, 140)}..."</p>` : ''}
          <div style="margin-top: 0.5rem;">${tags}</div>
        </div>
      `;
    }).join("");
  }

  // Radar Chart Rendering with Chart.js
  async function renderRadarChart() {
    const canvas = document.getElementById("studentRadarCanvas");
    if (!canvas) return;

    try {
      const resp = await fetch(`/api/students/${state.currentStudentId}/radar`);
      if (!resp.ok) return;

      const data = await resp.json();
      const cfg = data.chart_config;
      const comp = data.competencies || {};

      if (state.radarChart) {
        state.radarChart.destroy();
      }

      state.radarChart = new Chart(canvas, {
        type: "radar",
        data: cfg,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2, font: { size: 9 } },
              pointLabels: { font: { size: 10, weight: "bold" } },
              grid: { color: "rgba(0, 0, 0, 0.08)" },
              angleLines: { color: "rgba(0, 0, 0, 0.08)" }
            }
          },
          plugins: {
            legend: { position: "bottom", labels: { font: { size: 11, weight: "bold" } } }
          }
        }
      });

      // Render 15 dimension details list
      const breakdownEl = document.getElementById("radar-breakdown-details");
      if (breakdownEl) {
        breakdownEl.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <h5 style="color: var(--primary-navy); font-weight: 700; margin-bottom: 0.4rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2rem;">5 Phẩm chất cốt lõi:</h5>
              <p>Yêu nước: <b>${comp.yeu_nuoc || 9.0}</b></p>
              <p>Nhân ái: <b>${comp.nhan_ai || 9.2}</b></p>
              <p>Chăm chỉ: <b>${comp.cham_chi || 8.8}</b></p>
              <p>Trung thực: <b>${comp.trung_thuc || 9.5}</b></p>
              <p>Trách nhiệm: <b>${comp.trach_nhiem || 9.1}</b></p>
            </div>
            <div>
              <h5 style="color: var(--primary-navy); font-weight: 700; margin-bottom: 0.4rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2rem;">Năng lực học thuật & chuyên môn:</h5>
              <p>Năng lực Ngôn ngữ: <b>${comp.ngon_ngu || 9.5}</b></p>
              <p>Giải quyết vấn đề: <b>${comp.giai_quyet_van_de_sang_tao || 9.0}</b></p>
              <p>Giao tiếp & Hợp tác: <b>${comp.giao_tiep_hop_tac || 9.4}</b></p>
              <p>Tự chủ & Tự học: <b>${comp.tu_chu_tu_hoc || 9.0}</b></p>
              <p>Công nghệ & Tin học: <b>${comp.tin_hoc || 8.9}</b></p>
            </div>
          </div>
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--accent-gold-light); border-radius: var(--radius-md); font-size: 0.85rem;">
            <b>Nhận định thế mạnh nổi bật:</b> Học sinh có chỉ số vượt trội về <b>Năng lực Ngôn ngữ (9.5)</b> và <b>Giao tiếp - Hợp tác (9.4)</b>, hoàn toàn phù hợp cho các tiêu chuẩn phỏng vấn và xét học bổng THPT Chuyên Ngoại ngữ.
          </div>
        `;
      }
    } catch (err) {
      console.error("Error rendering radar chart:", err);
    }
  }

  function renderDigitalPassport() {
    const s = state.currentStudent;
    const bodyEl = document.getElementById("passport-content-body");
    const downloadBtn = document.getElementById("passport-pdf-download-btn");
    if (!s || !bodyEl) return;

    if (downloadBtn) {
      downloadBtn.href = `/api/students/${s.student_code || s.id}/passport/pdf`;
    }

    const projectsHtml = (s.signature_projects || []).map(p => `
      <div style="padding: 0.5rem; background: #f8fafc; border-radius: 6px; margin-bottom: 0.4rem; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between;">
          <b>${p.title}</b>
          <span style="color: var(--primary-navy); font-weight: 700;">${p.score || 9.0}/10.0</span>
        </div>
        <p style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem;">${p.summary || ''}</p>
      </div>
    `).join("");

    bodyEl.innerHTML = `
      <div class="grid-2" style="margin-bottom: 1.25rem;">
        <div>
          <p><b>Họ và tên:</b> ${s.full_name}</p>
          <p><b>Lớp:</b> ${s.class_name} (Khối ${s.grade})</p>
          <p><b>Mã học sinh:</b> ${s.student_code || s.id}</p>
          <p><b>Ngoại ngữ 2:</b> ${s.second_language || 'Tiếng Đức'}</p>
        </div>
        <div>
          <p><b>Điểm TB tích lũy (GPA):</b> <span style="font-size: 1.1rem; font-weight: 800; color: var(--primary-navy);">${s.gpa}/10.0</span></p>
          <p><b>Chứng chỉ Ngoại ngữ:</b> ${s.cefr_level || 'B2/C1'}</p>
          <p><b>Mục tiêu liên thông:</b> <b>${s.target_highschool || 'THPT Chuyên Ngoại ngữ (CNN)'}</b></p>
          <p><b>Xếp loại Rèn luyện:</b> ${s.conduct_grade || 'Tốt'}</p>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--primary-navy); margin-bottom: 0.5rem;">
        CÁC DỰ ÁN HỌC TẬP TIÊU BIỂU (SIGNATURE PROJECTS):
      </h4>
      ${projectsHtml || '<p style="font-size: 0.85rem; color: #64748b;">Đang cập nhật các dự án tiêu biểu...</p>'}

      <div style="margin-top: 1rem; padding: 0.85rem; background: var(--accent-gold-light); border-left: 3px solid var(--accent-gold); border-radius: 4px;">
        <h5 style="font-weight: 700; color: var(--primary-navy); margin-bottom: 0.3rem;">Lời nhận xét & Khuyến nghị của Giáo viên chủ nhiệm:</h5>
        <p style="font-size: 0.85rem; line-height: 1.45;">${s.notes || 'Học sinh có tư duy độc lập, giàu tính sáng tạo và khả năng biểu đạt song ngữ xuất sắc, sẵn sàng cho kỳ thi tuyển sinh THPT Chuyên Ngoại ngữ.'}</p>
      </div>
    `;
  }

  // =========================================================================
  // 4. SUBMISSION MODAL & AI PRE-CHECK
  // =========================================================================

  function setupSubmissionModal() {
    const modal = document.getElementById("submit-project-modal");
    const openBtn = document.getElementById("btn-open-submit-modal");
    const closeBtn = document.getElementById("btn-close-modal");
    const cancelBtn = document.getElementById("btn-cancel-modal");
    const form = document.getElementById("project-submission-form");
    const preCheckBtn = document.getElementById("btn-precheck-ai");
    const preCheckResult = document.getElementById("pre-check-result-box");

    if (openBtn) openBtn.addEventListener("click", () => modal.classList.add("active"));
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("active"));
    if (cancelBtn) cancelBtn.addEventListener("click", () => modal.classList.remove("active"));

    if (preCheckBtn) {
      preCheckBtn.addEventListener("click", async () => {
        const content = document.getElementById("submit-content").value;
        const category = document.getElementById("submit-category").value;
        if (!content.trim()) {
          alert("Vui lòng nhập nội dung bài viết trước khi kiểm tra!");
          return;
        }

        try {
          preCheckResult.style.display = "block";
          preCheckResult.style.background = "#eff6ff";
          preCheckResult.style.color = "#1d4ed8";
          preCheckResult.innerHTML = "Đang phân tích bài nộp bằng Core AI Engine...";

          const resp = await fetch("/api/ai/pre-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, category }),
          });

          if (resp.ok) {
            const data = await resp.json();
            preCheckResult.style.background = "#ecfdf5";
            preCheckResult.style.color = "#065f46";
            preCheckResult.innerHTML = `
              <b>Độ sẵn sàng:</b> ${data.readiness} (${data.word_count} từ)<br/>
              <b>Kỹ năng dự đoán:</b> ${data.predicted_skills.join(", ")}<br/>
              ${data.suggestions.map(s => `• ${s}`).join("<br/>")}
            `;
          }
        } catch (err) {
          preCheckResult.style.background = "#fef2f2";
          preCheckResult.style.color = "#991b1b";
          preCheckResult.textContent = "Không thể kiểm tra lúc này.";
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("submit-title").value;
        const category = document.getElementById("submit-category").value;
        const language = document.getElementById("submit-language").value;
        const content = document.getElementById("submit-content").value;
        const reflection = document.getElementById("submit-reflection").value;

        try {
          const resp = await fetch("/api/projects/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              category,
              language,
              content,
              reflection,
              student_id: state.currentStudentId,
              student_name: state.currentStudent ? state.currentStudent.full_name : "Học sinh UMS",
            }),
          });

          if (resp.ok) {
            alert("Nộp bài dự án thành công! AI Rubric Engine đã tự động đánh giá minh chứng của em.");
            modal.classList.remove("active");
            form.reset();
            preCheckResult.style.display = "none";
            await loadStudentProjects();
            await renderRadarChart();
          }
        } catch (err) {
          alert("Lỗi kết nối khi nộp bài: " + err);
        }
      });
    }
  }

  // =========================================================================
  // 5. TEACHER VIEW: ROSTER, RUBRIC GRADING & REPORT GENERATOR
  // =========================================================================

  function setupTeacherWorkspace() {
    // Rubric slider dynamic score calculations
    const sliders = ["c1", "c2", "c3", "c4"];
    sliders.forEach(id => {
      const slider = document.getElementById(`slider-${id}`);
      if (slider) {
        slider.addEventListener("input", (e) => {
          document.getElementById(`score-val-${id}`).textContent = parseFloat(e.target.value).toFixed(1);
          updateTotalRubricScore();
        });
      }
    });

    const aiGradeBtn = document.getElementById("btn-ai-auto-grade");
    if (aiGradeBtn) {
      aiGradeBtn.addEventListener("click", triggerAIAutoGrade);
    }

    const saveGradeBtn = document.getElementById("btn-save-grade");
    if (saveGradeBtn) {
      saveGradeBtn.addEventListener("click", saveTeacherGrade);
    }

    const genReportBtn = document.getElementById("btn-generate-ai-report");
    if (genReportBtn) {
      genReportBtn.addEventListener("click", generateTeacherAIReport);
    }

    const saveReportBtn = document.getElementById("btn-save-report-edits");
    if (saveReportBtn) {
      saveReportBtn.addEventListener("click", saveTeacherReportEdits);
    }
  }

  function updateTotalRubricScore() {
    const c1 = parseFloat(document.getElementById("slider-c1")?.value || 0);
    const c2 = parseFloat(document.getElementById("slider-c2")?.value || 0);
    const c3 = parseFloat(document.getElementById("slider-c3")?.value || 0);
    const c4 = parseFloat(document.getElementById("slider-c4")?.value || 0);
    const total = (c1 + c2 + c3 + c4).toFixed(1);

    const totalEl = document.getElementById("rubric-total-display");
    if (totalEl) totalEl.textContent = `${total} / 10.0`;
  }

  function renderTeacherRoster() {
    const tbody = document.getElementById("teacher-roster-tbody");
    if (!tbody || state.students.length === 0) return;

    tbody.innerHTML = state.students.map(s => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 0.75rem; font-weight: 600;">${s.student_code || s.id}</td>
        <td style="padding: 0.75rem;">${s.full_name}</td>
        <td style="padding: 0.75rem;">${s.class_name}</td>
        <td style="padding: 0.75rem;">${s.second_language || 'German'}</td>
        <td style="padding: 0.75rem; font-weight: 700; color: var(--primary-navy);">${s.gpa}</td>
        <td style="padding: 0.75rem;"><span class="skill-badge" style="background:#ecfdf5; color:#065f46;">Đã hoàn thành</span></td>
        <td style="padding: 0.75rem; text-align: center;">
          <button class="btn btn-sm btn-secondary" onclick="window.selectStudentForTeacher('${s.id}')">
            Xem & Chấm
          </button>
        </td>
      </tr>
    `).join("");
  }

  window.selectStudentForTeacher = function(studentId) {
    state.currentStudentId = studentId;
    personaSelect.value = studentId;
    loadCurrentStudentData();
    // Switch to rubric grading tab
    const rubricTabBtn = document.querySelector('[data-target="tab-teacher-rubric"]');
    if (rubricTabBtn) rubricTabBtn.click();
  };

  async function loadTeacherGradingProjects() {
    const sel = document.getElementById("teacher-rubric-project-select");
    if (!sel) return;

    try {
      const resp = await fetch("/api/projects");
      if (resp.ok) {
        const allProjects = await resp.json();
        sel.innerHTML = allProjects.map(p => `
          <option value="${p.id || p.submission_id}">${p.title} (${p.category})</option>
        `).join("");

        if (allProjects.length > 0) {
          showSubmissionInTeacherPreview(allProjects[0]);
          state.currentGradingProject = allProjects[0];
        }

        sel.addEventListener("change", (e) => {
          const selected = allProjects.find(p => (p.id || p.submission_id) === e.target.value);
          if (selected) {
            showSubmissionInTeacherPreview(selected);
            state.currentGradingProject = selected;
          }
        });
      }
    } catch (err) {
      console.error("Error loading teacher grading projects:", err);
    }
  }

  function showSubmissionInTeacherPreview(prj) {
    const previewEl = document.getElementById("teacher-submission-preview");
    if (!previewEl || !prj) return;

    previewEl.innerHTML = `
      <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--primary-navy); margin-bottom: 0.5rem;">
        ${prj.title}
      </h4>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
        <span class="skill-badge gold">${prj.category}</span>
        <span class="skill-badge">Môn: ${prj.subject || 'Liên môn'}</span>
      </div>
      <div style="white-space: pre-wrap; font-size: 0.88rem; line-height: 1.6; color: #334155; margin-bottom: 1rem;">
        ${prj.content_text || prj.content || 'Nội dung bài nộp...'}
      </div>
      ${prj.reflection ? `
        <div style="background: #f8fafc; padding: 0.75rem; border-left: 3px solid var(--accent-gold); border-radius: 4px;">
          <b>Nhật ký phản tư của học sinh:</b><br/>
          <i>"${prj.reflection}"</i>
        </div>
      ` : ''}
    `;
  }

  async function triggerAIAutoGrade() {
    if (!state.currentGradingProject) return;

    try {
      const resp = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.currentGradingProject.title,
          category: state.currentGradingProject.category,
          content: state.currentGradingProject.content_text || state.currentGradingProject.content,
          reflection: state.currentGradingProject.reflection,
        }),
      });

      if (resp.ok) {
        const evalRes = await resp.json();
        const rub = evalRes.rubric;

        document.getElementById("slider-c1").value = rub.content_depth;
        document.getElementById("score-val-c1").textContent = rub.content_depth.toFixed(1);

        document.getElementById("slider-c2").value = rub.language_expression;
        document.getElementById("score-val-c2").textContent = rub.language_expression.toFixed(1);

        document.getElementById("slider-c3").value = rub.critical_innovation;
        document.getElementById("score-val-c3").textContent = rub.critical_innovation.toFixed(1);

        document.getElementById("slider-c4").value = rub.collaboration_integrity;
        document.getElementById("score-val-c4").textContent = rub.collaboration_integrity.toFixed(1);

        updateTotalRubricScore();

        const feedbackBox = document.getElementById("teacher-feedback-input");
        if (feedbackBox) {
          feedbackBox.value = evalRes.feedback || "Bài nộp thể hiện tư duy học thuật xuất sắc và khả năng ngôn ngữ lưu loát.";
        }
      }
    } catch (err) {
      alert("Lỗi khi gọi AI chấm bài: " + err);
    }
  }

  async function saveTeacherGrade() {
    if (!state.currentGradingProject) return;
    const prjId = state.currentGradingProject.id || state.currentGradingProject.submission_id;

    const c1 = parseFloat(document.getElementById("slider-c1").value);
    const c2 = parseFloat(document.getElementById("slider-c2").value);
    const c3 = parseFloat(document.getElementById("slider-c3").value);
    const c4 = parseFloat(document.getElementById("slider-c4").value);
    const total = parseFloat((c1 + c2 + c3 + c4).toFixed(1));
    const feedback = document.getElementById("teacher-feedback-input").value;

    try {
      const resp = await fetch(`/api/projects/${prjId}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria_scores: { content_depth: c1, language: c2, critical: c3, collaboration: c4 },
          total_score: total,
          teacher_feedback: feedback,
        }),
      });

      if (resp.ok) {
        alert("Đã lưu điểm và nhận xét của giáo viên thành công!");
        await loadStudentProjects();
      }
    } catch (err) {
      alert("Lỗi lưu điểm: " + err);
    }
  }

  async function generateTeacherAIReport() {
    const studentSelect = document.getElementById("report-student-select");
    const studentId = studentSelect ? studentSelect.value : state.currentStudentId;

    try {
      const resp = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          semester: "Học kỳ I",
          school_year: "2025-2026",
          teacher_type: "homeroom",
        }),
      });

      if (resp.ok) {
        state.currentReport = await resp.json();
        const r = state.currentReport;

        document.getElementById("report-sec-academic").value = r.section_academic || "";
        document.getElementById("report-sec-qualities").value = r.section_qualities || "";
        document.getElementById("report-sec-orientation").value = r.section_orientation || "";

        const exportBtn = document.getElementById("btn-export-report-pdf");
        if (exportBtn && r.report_id) {
          exportBtn.href = `/api/reports/${r.report_id}/pdf`;
        }
      }
    } catch (err) {
      alert("Lỗi tạo bản nhận xét: " + err);
    }
  }

  async function saveTeacherReportEdits() {
    if (!state.currentReport || !state.currentReport.report_id) {
      alert("Vui lòng sinh nhận xét bằng AI trước khi lưu chỉnh sửa!");
      return;
    }

    const repId = state.currentReport.report_id;
    const acad = document.getElementById("report-sec-academic").value;
    const qual = document.getElementById("report-sec-qualities").value;
    const orient = document.getElementById("report-sec-orientation").value;

    try {
      const resp = await fetch(`/api/reports/${repId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_eval: acad,
          soft_skills_eval: qual,
          highschool_pathway_advice: orient,
        }),
      });

      if (resp.ok) {
        alert("Đã lưu bản nhận xét đã chỉnh sửa! Không có placeholder chưa xử lý.");
      } else {
        const err = await resp.json();
        alert("Cảnh báo kiểm tra: " + (err.detail || "Không thể lưu"));
      }
    } catch (err) {
      alert("Lỗi lưu nhận xét: " + err);
    }
  }

  // =========================================================================
  // 6. PARENT VIEW: TIMELINE & 24/7 AI COMPANION
  // =========================================================================

  async function renderParentTimeline() {
    const streamEl = document.getElementById("parent-timeline-stream");
    if (!streamEl) return;

    try {
      const resp = await fetch(`/api/parent/timeline/${state.currentStudentId}`);
      if (!resp.ok) return;

      const events = await resp.json();
      if (!events || events.length === 0) {
        streamEl.innerHTML = `<p style="color: var(--text-muted);">Đang cập nhật dòng thời gian...</p>`;
        return;
      }

      streamEl.innerHTML = events.map(ev => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="timeline-date">${ev.date || '2026-03-15'} • ${ev.category || 'Dự án'}</div>
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--primary-navy); margin-bottom: 0.35rem;">
              ${ev.title}
            </h4>
            <p style="font-size: 0.88rem; color: #475569; margin-bottom: 0.5rem; line-height: 1.4;">
              ${ev.description || ''}
            </p>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              ${ev.score ? `<span class="score-badge score-high">${ev.score}/10.0</span>` : ''}
              ${ev.badge ? `<span class="skill-badge gold">🏅 ${ev.badge}</span>` : ''}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.error("Error rendering timeline:", err);
    }
  }

  function setupParentChatbot() {
    const sendBtn = document.getElementById("btn-send-chat");
    const inputField = document.getElementById("chat-input-field");
    const chips = document.querySelectorAll(".chat-chip-btn");
    const messagesBox = document.getElementById("chat-messages-box");
    const cheerBtn = document.getElementById("btn-send-parent-cheer");

    if (cheerBtn) {
      cheerBtn.addEventListener("click", () => {
        const cheerText = document.getElementById("parent-cheer-message").value;
        if (!cheerText.trim()) {
          alert("Quý Phụ huynh vui lòng nhập lời động viên trước khi gửi!");
          return;
        }
        alert("❤️ Lời động viên yêu thương của Quý Phụ huynh đã được chuyển đến góc học tập của con!");
        document.getElementById("parent-cheer-message").value = "";
      });
    }

    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        const q = chip.dataset.query;
        if (inputField) {
          inputField.value = q;
          handleSendChat();
        }
      });
    });

    if (sendBtn) sendBtn.addEventListener("click", handleSendChat);
    if (inputField) {
      inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSendChat();
      });
    }

    async function handleSendChat() {
      const q = inputField.value.trim();
      if (!q) return;

      // Append user bubble
      appendChatBubble(q, "user");
      inputField.value = "";

      // Append typing indicator
      const typingBubble = appendChatBubble("Trợ lý UMS đang suy nghĩ...", "bot");

      try {
        const resp = await fetch("/api/parent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, student_id: state.currentStudentId }),
        });

        if (resp.ok) {
          const res = await resp.json();
          typingBubble.textContent = res.reply || "Dạ, Nhà trường luôn sẵn sàng đồng hành cùng Quý Phụ huynh!";
        } else {
          typingBubble.textContent = "Dạ, hệ thống đang tạm bận. Quý Phụ huynh vui lòng thử lại sau giây lát ạ.";
        }
      } catch (err) {
        typingBubble.textContent = "Không thể kết nối với máy chủ AI lúc này.";
      }
    }

    function appendChatBubble(text, sender) {
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${sender}`;
      bubble.textContent = text;
      messagesBox.appendChild(bubble);
      messagesBox.scrollTop = messagesBox.scrollHeight;
      return bubble;
    }
  }

  // Boot Application
  initApp();
});
