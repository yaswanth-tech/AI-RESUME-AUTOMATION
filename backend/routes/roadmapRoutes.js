const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prismaClient');

const ROADMAPS_PATH = path.join(__dirname, '../datasets/roadmaps.json');

/**
 * Helper to sync/seed all templates from datasets/roadmaps.json
 */
async function syncTemplates() {
  if (!fs.existsSync(ROADMAPS_PATH)) return;
  const rawData = fs.readFileSync(ROADMAPS_PATH, 'utf8');
  const templates = JSON.parse(rawData);

  for (const t of templates) {
    const template = await prisma.roadmapTemplate.upsert({
      where: { id: t.id },
      update: {
        title: t.title,
        description: t.description,
        targetBatch: t.target_batch
      },
      create: {
        id: t.id,
        title: t.title,
        description: t.description,
        targetBatch: t.target_batch
      }
    });

    await prisma.roadmapTask.deleteMany({
      where: { phase: { templateId: template.id } }
    });
    await prisma.roadmapPhase.deleteMany({
      where: { templateId: template.id }
    });

    for (const p of t.phases) {
      const phase = await prisma.roadmapPhase.create({
        data: {
          templateId: template.id,
          phaseNumber: p.phase_number,
          title: p.title,
          durationWeeks: p.duration_weeks,
          description: p.description,
          opportunityUnlockId: p.opportunity_unlock_id
        }
      });

      if (p.tasks && p.tasks.length > 0) {
        await prisma.roadmapTask.createMany({
          data: p.tasks.map(task => ({
            phaseId: phase.id,
            weekNumber: task.week,
            title: task.title,
            type: task.type,
            deliverable: task.deliverable
          }))
        });
      }
    }
  }
}

/**
 * GET /api/roadmaps
 * Lists all available roadmap templates
 */
router.get('/', async (req, res) => {
  try {
    let templates = await prisma.roadmapTemplate.findMany({
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            tasks: { orderBy: { weekNumber: 'asc' } }
          }
        }
      }
    });

    // Auto-seed if database was empty
    if (templates.length === 0) {
      await syncTemplates();
      templates = await prisma.roadmapTemplate.findMany({
        include: {
          phases: {
            orderBy: { phaseNumber: 'asc' },
            include: {
              tasks: { orderBy: { weekNumber: 'asc' } }
            }
          }
        }
      });
    }

    const data = templates.map(t => {
      const totalWeeks = t.phases.reduce((sum, p) => sum + (p.durationWeeks || 0), 0);
      const totalTasks = t.phases.reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        targetBatch: t.targetBatch,
        totalWeeks,
        totalTasks,
        phasesCount: t.phases.length,
        phases: t.phases
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error(JSON.stringify({ event: 'roadmaps_list_failed', status: 500 }));
    res.status(500).json({ success: false, message: 'Could not load roadmaps.' });
  }
});

/**
 * POST /api/roadmaps/sync
 * Syncs the JSON roadmap templates into the database.
 */
router.post('/sync', async (req, res) => {
  try {
    await syncTemplates();
    res.json({ success: true, message: "Roadmap templates synced successfully." });
  } catch (error) {
    console.error(JSON.stringify({ event: 'roadmap_sync_failed', status: 500 }));
    res.status(500).json({ success: false, message: 'Could not sync roadmap templates.' });
  }
});

/**
 * GET /api/roadmaps/user/:userId
 * Retrieves user roadmap progress and template details
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    let progress = await prisma.userRoadmapProgress.findFirst({
      where: { userId }
    });

    if (!progress) {
      // Check if user has a prescribed template from diagnosis
      const diag = await prisma.diagnosisResult.findUnique({ where: { userId } });
      const templateId = diag?.prescribedTemplate || "ai-ml-fast-track-2026";
      progress = await prisma.userRoadmapProgress.create({
        data: {
          userId,
          templateId,
          currentPhase: 1,
          completedTasks: []
        }
      });
    }

    const template = await prisma.roadmapTemplate.findUnique({
      where: { id: progress.templateId },
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            tasks: { orderBy: { weekNumber: 'asc' } }
          }
        }
      }
    });

    const totalTasks = template?.phases?.reduce((sum, p) => sum + (p.tasks?.length || 0), 0) || 0;
    const completedCount = (progress.completedTasks || []).length;
    const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        progress,
        template,
        totalTasks,
        completedCount,
        progressPercent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load user roadmap.' });
  }
});

/**
 * GET /api/roadmaps/:id
 * Fetches a full roadmap template with all phases and tasks.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let roadmap = await prisma.roadmapTemplate.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            tasks: {
              orderBy: { weekNumber: 'asc' }
            }
          }
        }
      }
    });

    // Fallback: auto-sync if missing
    if (!roadmap) {
      await syncTemplates();
      roadmap = await prisma.roadmapTemplate.findUnique({
        where: { id },
        include: {
          phases: {
            orderBy: { phaseNumber: 'asc' },
            include: {
              tasks: {
                orderBy: { weekNumber: 'asc' }
              }
            }
          }
        }
      });
    }

    if (!roadmap) {
      return res.status(404).json({ success: false, message: "Roadmap not found." });
    }

    res.json({ success: true, data: roadmap });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load roadmap.' });
  }
});

/**
 * POST /api/roadmaps/init
 * Initializes a user's progress on a specific roadmap.
 */
router.post('/init', async (req, res) => {
  try {
    const { userId, templateId } = req.body;
    const effectiveTemplateId = templateId || "ai-ml-fast-track-2026";

    let progress = await prisma.userRoadmapProgress.findFirst({
      where: { userId, templateId: effectiveTemplateId }
    });

    if (!progress) {
      progress = await prisma.userRoadmapProgress.create({
        data: {
          userId,
          templateId: effectiveTemplateId,
          currentPhase: 1,
          completedTasks: []
        }
      });
    }

    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not initialize roadmap progress.' });
  }
});

/**
 * POST /api/roadmaps/toggle-task
 * Toggles a single task completed/incompleted and updates phase & dashboard
 */
router.post('/toggle-task', async (req, res) => {
  try {
    const { userId, templateId, taskId } = req.body;
    if (!userId || !templateId || !taskId) {
      return res.status(400).json({ success: false, message: 'userId, templateId, and taskId are required.' });
    }

    let progress = await prisma.userRoadmapProgress.findFirst({
      where: { userId, templateId }
    });

    if (!progress) {
      progress = await prisma.userRoadmapProgress.create({
        data: { userId, templateId, currentPhase: 1, completedTasks: [] }
      });
    }

    let completedTasks = Array.isArray(progress.completedTasks) ? [...progress.completedTasks] : [];
    const isCompleted = completedTasks.includes(taskId);

    if (isCompleted) {
      completedTasks = completedTasks.filter(id => id !== taskId);
    } else {
      completedTasks.push(taskId);
    }

    // Determine current phase based on completed tasks
    const template = await prisma.roadmapTemplate.findUnique({
      where: { id: templateId },
      include: { phases: { include: { tasks: true }, orderBy: { phaseNumber: 'asc' } } }
    });

    let newCurrentPhase = 1;
    let totalTasks = 0;
    if (template && template.phases) {
      for (const phase of template.phases) {
        totalTasks += phase.tasks.length;
        const taskIds = phase.tasks.map(t => t.id);
        const isPhaseDone = taskIds.length > 0 && taskIds.every(id => completedTasks.includes(id));
        if (isPhaseDone) {
          newCurrentPhase = phase.phaseNumber + 1;
        } else {
          break;
        }
      }
    }

    await prisma.userRoadmapProgress.updateMany({
      where: { userId, templateId },
      data: {
        completedTasks,
        currentPhase: newCurrentPhase,
        lastActive: new Date()
      }
    });

    const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Log Activity for dashboard
    try {
      const { logActivity } = require('../utils/activityLogger');
      await logActivity(
        userId,
        "Roadmap",
        isCompleted ? "UPDATE" : "COMPLETE",
        `Roadmap Task ${isCompleted ? 'unmarked' : 'completed'} - Phase ${newCurrentPhase} (${progressPercent}%)`,
        progressPercent,
        "IN_PROGRESS"
      );
    } catch (logErr) {
      // Non-fatal
    }

    res.json({
      success: true,
      completed: !isCompleted,
      completedTasks,
      currentPhase: newCurrentPhase,
      progressPercent
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'roadmap_toggle_task_failed', status: 500 }));
    res.status(500).json({ success: false, message: 'Could not update task state.' });
  }
});

/**
 * POST /api/roadmaps/update-progress
 * Marks multiple tasks as completed
 */
router.post('/update-progress', async (req, res) => {
  try {
    const { userId, templateId, completedTaskIds } = req.body;

    await prisma.userRoadmapProgress.updateMany({
      where: { userId, templateId },
      data: {
        completedTasks: completedTaskIds,
        lastActive: new Date()
      }
    });

    const template = await prisma.roadmapTemplate.findUnique({
      where: { id: templateId },
      include: { phases: { include: { tasks: true }, orderBy: { phaseNumber: 'asc' } } }
    });

    let newCurrentPhase = 1;
    let totalTasks = 0;
    if (template && template.phases) {
      for (const phase of template.phases) {
        totalTasks += phase.tasks.length;
        const taskIds = phase.tasks.map(t => t.id);
        const isPhaseComplete = taskIds.length > 0 && taskIds.every(id => completedTaskIds.includes(id));
        if (isPhaseComplete) {
          newCurrentPhase = phase.phaseNumber + 1;
        } else {
          break;
        }
      }
    }

    await prisma.userRoadmapProgress.updateMany({
      where: { userId, templateId },
      data: { currentPhase: newCurrentPhase }
    });

    const progressPercent = totalTasks > 0 ? Math.round((completedTaskIds.length / totalTasks) * 100) : 0;

    try {
      const { logActivity } = require('../utils/activityLogger');
      await logActivity(
        userId,
        "Roadmap",
        "GENERATE",
        `Roadmap Progress: Phase ${newCurrentPhase} reached (${progressPercent}%)`,
        progressPercent,
        "IN_PROGRESS"
      );
    } catch (logErr) {
      // Non-fatal
    }

    res.json({ success: true, currentPhase: newCurrentPhase, progressPercent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not update roadmap progress.' });
  }
});

module.exports = router;
module.exports.syncTemplates = syncTemplates;
