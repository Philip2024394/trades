// KPE · Default plugin registrations
//
// This module registers the reference implementation of every pipeline
// stage. Imported once at boot by the registry's `ensureDefaultsLoaded()`.
// Any of these can be overridden later by calling `registerPlugin()` with
// a competing implementation of the same StageName.

import { registerPlugin } from "../registry";

import { IntakeStage }        from "../stages/intake";
import { CleaningStage }      from "../stages/cleaning";
import { NormalisationStage } from "../stages/normalisation";
import { ClassifierStage }    from "../stages/classifier";
import { MetadataStage }      from "../stages/metadata";
import { DuplicateStage }     from "../stages/duplicate";
import { ChunkingStage }      from "../stages/chunking";
import { RelationshipsStage } from "../stages/relationships";
import { ValidationStage }    from "../stages/validation";
import { DecisionStage }      from "../stages/decision";
import { AIGatewayStage }     from "../stages/ai-gateway";
import { BrainWriterStage }   from "../stages/brain-writer";

registerPlugin(IntakeStage);
registerPlugin(CleaningStage);
registerPlugin(NormalisationStage);
registerPlugin(ClassifierStage);
registerPlugin(MetadataStage);
registerPlugin(DuplicateStage);
registerPlugin(ChunkingStage);
registerPlugin(RelationshipsStage);
registerPlugin(ValidationStage);
registerPlugin(DecisionStage);
registerPlugin(AIGatewayStage);
registerPlugin(BrainWriterStage);
