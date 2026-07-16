# Production deployment

When the user says «залей на прод», «задеплой», «выкати в прод», «обнови прод» or asks to deploy/release Asyusha Pro, read `.agents/skills/deploy-asyusha-production/SKILL.md` completely and follow it.

Production deploys must go through `deploy/deploy.sh`. Do not deploy with `rsync` or `scp`: commit and push the intended local changes first, then let the VPS pull that exact commit.
