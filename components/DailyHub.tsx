"use client";

import { useState, useEffect, useMemo, memo } from "react";
import type { User } from "@/app/types";
import { getUserLevel } from "@/app/utils";
import { FLOORS } from "@/app/config";

// ─── Next Feature Unlock ────────────────────────────────────────────────────
function getNextUnlock(level: number): { level: number; features: string[]; color: string } | null {
  for (const floor of FLOORS) {
    if (floor.minLevel && floor.minLevel > level) {
      return { level: floor.minLevel, features: [floor.name], color: floor.color };
    }
    for (const room of floor.rooms) {
      const roomLevel = room.minLevel ?? floor.minLevel ?? 1;
      if (roomLevel > level) {
        return { level: roomLevel, features: [room.label], color: floor.color };
      }
    }
  }
  return null;
}

// ─── Companion daily quotes (Skulduggery-humor) ─────────────────────────────
// 15+ per type so quotes don't repeat within 2 weeks.
// Rules: NO motivation. NO poetry. Dry humor from the companion's CHARACTER.
// Every quote needs a LANDING — the last sentence is the punchline.
const COMPANION_DAILY_QUOTES: Record<string, string[]> = {
  cat: [
    "{name} stares at you. Then at the quest board. The message is clear.",
    "{name} yawns. Not boredom — judging you is exhausting work.",
    "{name} is asleep on your quest list. This is either a statement or a nap.",
    "{name} has knocked three items off your desk. Coincidentally, all were excuses.",
    "{name} sat on your keyboard. The resulting text was more productive than yesterday.",
    "{name} brought you a dead mouse. As a metaphor. For your last quest attempt.",
    "{name} is grooming. Not itself. Your reputation.",
    "{name} stared at the wall for forty minutes. {name} calls it 'planning'. You call it 'Tuesday'.",
    "{name} pushed your water glass to the edge of the table. A reminder that everything is temporary.",
    "{name} claims the sunny spot on your desk. Strategy, not laziness. There's a difference. Apparently.",
    "{name} watched you sleep. Counted your breaths. Found them adequate. Barely.",
    "{name} has opinions about your quest selection. {name} expressed them by sitting on the wrong ones.",
    "{name} purrs exclusively when you're trying to concentrate. Coincidence is for amateurs.",
    "{name} looked at your streak counter, then looked at you, then closed its eyes. Verdicts don't need words.",
    "{name} knocked your daily bonus notification off the table. Some lessons are physical.",
    "{name} curled up in a perfect circle. Geometry comes naturally. Responsibility does not.",
    "{name} stretched exactly once. With maximum drama. Oscar-worthy.",
    "{name} meowed at a closed door. Not because it wanted in. It wanted you to know the door exists.",
    "{name} chose your lap. Not your partner's. Not the couch. Your lap. You are now furniture. Act accordingly.",
    "{name} caught a fly. Let it go. Caught it again. {name} is studying the concept of 'effort versus reward'.",
    "{name} left fur on your black shirt. A territorial claim. You belong to {name} now.",
    "{name} hissed at nothing. Preventive measures. The nothing looked suspicious.",
    "{name} kneaded the blanket for twenty minutes. The blanket offered no resistance. You should take notes.",
    "{name} climbed to the highest shelf. Not to survey. To look down. There's a difference and it's vertical.",
    "{name} ignored the expensive toy. Played with the box. {name} understands value. You bought the toy.",
    "{name} ran sideways at full speed for no reason. Art doesn't need justification.",
    "{name} sniffed your food. Walked away. The food has been evaluated and found unworthy.",
    "{name} is plotting something. You can tell because {name} looks relaxed. Relaxed cats are the dangerous ones.",
    "{name} gave you one slow blink. In cat, that means 'I trust you.' Or 'you're boring.' Same blink.",
    "{name} purred. Not for you. At you. There's a power dynamic here and you're not winning it.",
  ],
  dog: [
    "{name} brought you a quest. It's slightly chewed, but the intent is pure.",
    "{name} has faith in you. Unconditional, unearned, and slightly suspicious.",
    "{name} sat by the door. Someone has to guard against procrastination.",
    "{name} is spinning in circles. This is either excitement or a navigation error.",
    "{name} tilts head. The head-tilt is not confusion — it's polite disappointment.",
    "{name} fetched your to-do list. It came back wetter than expected. Some items are illegible now. Probably the hard ones.",
    "{name} barked at the screen. Not a bug report. More of a general protest.",
    "{name} rolled over. Not for belly rubs — for dramatic emphasis on your incomplete quests.",
    "{name} is wagging. The wag has nothing to do with your performance. {name} wags at everything. You are not special. You are loved anyway.",
    "{name} ate a sock. Unrelated to your quests but felt like you should know.",
    "{name} dug a hole in the backyard. For your excuses. It's quite deep now.",
    "{name} has been staring at the front door since 6 AM. Not because someone's coming. Because hope is a full-time occupation.",
    "{name} heard the treat bag and forgot everything else. You should try that kind of focus.",
    "{name} put a paw on your hand. Not affection. Intervention.",
    "{name} learned 'sit' and 'stay'. Now working on 'why haven't you started yet'.",
    "{name} chased its tail. Caught it. Didn't know what to do next. A relatable victory.",
    "{name} brought you a shoe. The wrong shoe. But the speed was impressive.",
    "{name} sneezed. Then looked at you like you caused it. Evidence was inconclusive.",
    "{name} leaned against your leg. Not for warmth. For structural support. Yours, not {name}'s.",
    "{name} got excited about a walk. You said 'quest'. Same energy, apparently.",
    "{name} whimpered at the fridge. The fridge contains no quests. {name} disagrees.",
    "{name} is lying on your feet. Strategically. You can't leave now. The quests come to you.",
    "{name} destroyed a cushion. Not out of spite. Out of enthusiasm. For what, nobody knows.",
    "{name} played dead. Unconvincingly. The tail was still wagging. Method acting needs work.",
    "{name} met another dog. Forgot you existed for forty seconds. Then remembered. Then forgot again.",
    "{name} is sitting in the exact center of the hallway. Not lost. Stationed. There's a system. You don't understand it.",
    "{name} licked your face. Not love. Reconnaissance. {name} knows what you had for lunch now.",
    "{name} looked at the rain and then at you. The rain is not {name}'s fault. But {name} takes it personally when you're sad.",
    "{name} fell asleep mid-fetch. The stick is still out there. So is {name}'s dignity.",
    "{name} pressed its nose against the window. Fogging up the glass. Drawing a quest map. In dog.",
  ],
  dragon: [
    "{name} breathed on your coffee. It's warm now. You're welcome.",
    "{name} burned your excuses. Literally. The desk is fine. Mostly.",
    "{name} is not impressed. {name} is never impressed. That's the point.",
    "{name} set the quest board on fire. To be fair, it was a slow news day.",
    "{name} hoards gold. You hoard unfinished quests. One of you has better priorities.",
    "{name} ate a candle. Not out of hunger. Out of boredom. Your fault, apparently.",
    "{name} scorched the ceiling. In {name}'s defense, the ceiling was asking for it.",
    "{name} looked at your gear score and exhaled smoke. Not fire — disappointment has a lower temperature.",
    "{name} flew in circles for an hour. Called it 'reconnaissance'. Found nothing. Blamed the weather.",
    "{name} considers your streak adequately maintained. High praise. {name} once burned a castle for less.",
    "{name} tried to eat the forge. Grimvar was not amused. {name} was not sorry.",
    "{name} shed a scale. It's worth more than your best item. Neither of you mentions it.",
    "{name} curled around your quest list protectively. Not because it's valuable. Because it's flammable.",
    "{name} sneezed. Three tapestries are gone. A surprisingly productive sneeze, all things considered.",
    "{name} stared into the Rift for thirty seconds and lost interest. The Rift took it personally.",
    "{name} yawned. A small flame escaped. The curtains survived. This time.",
    "{name} filed its claws on the stone floor. The floor lost three inches. The floor has opinions now.",
    "{name} looked at the tavern menu. Everything is now 'well done.' By default.",
    "{name} tried to be subtle. The scorch marks disagree. Subtlety is not in the genome.",
    "{name} perched on the rooftop. The roof is warm now. You're welcome, everyone on the top floor.",
    "{name} watched you craft. Snorted. Literally. The recipe is now smoked. Improved? Debatable.",
    "{name} circled the tower once. For exercise. Six buildings reported 'unexpected warmth events.'",
    "{name} found your old gear in the inventory. Melted it. Called it 'decluttering.' Not wrong.",
    "{name} slept on the gold pile. Every dragon does this. It's in the contract.",
    "{name} accidentally made eye contact with the World Boss. The World Boss blinked first.",
    "{name} laid an egg. Not a real egg. A fire egg. It's decorative. And warm. And slightly sentient.",
    "{name} roared at your alarm clock. The alarm clock doesn't work anymore. You woke up anyway. Fear is efficient.",
    "{name} considers you a friend. {name} also considered the last volcano a friend. Standards are flexible.",
    "{name} landed on the balcony. The balcony now has a structural rating of 'hopeful.'",
    "{name} tried whispering. It was 90 decibels. A record, for a whisper. And for structural damage.",
  ],
  owl: [
    "{name} read three books while you slept. {name} has thoughts.",
    "{name} hooted at 3 AM. It was wisdom. You weren't listening.",
    "{name} arranged your quests by priority. Silently. Judgmentally.",
    "{name} blinked twice. In owl language, that's a thesis statement.",
    "{name} organized your inventory alphabetically. Then by color. Then gave up and organized it by disappointment level.",
    "{name} stayed up all night researching optimal quest routes. The conclusion: you should have started earlier.",
    "{name} left a bookmark in your Codex. Page 47. Paragraph 3. The footnote. The one you skipped.",
    "{name} rotated its head 270 degrees to look at your quest log. The extra 90 degrees were editorial.",
    "{name} found an error in your math. Didn't correct it. Wants to see how this plays out.",
    "{name} dropped a pellet. It contained the remains of your last excuse. Owls are efficient like that.",
    "{name} is perched on the highest shelf. For perspective. On your choices.",
    "{name} wrote you a note. It says 'Adequate.' {name} considers this generous.",
    "{name} filed your achievements chronologically. The gaps are... noted.",
    "{name} has read every Codex entry twice. Found three typos. Reported none. Some knowledge is a burden.",
    "{name} prefers silence. Not because there's nothing to say — because everything has already been said, and you weren't listening the first time.",
    "{name} caught a mouse. Studied it. Released it. The mouse is now more educated than most.",
    "{name} opened one eye. Closed it. Opened it again. The review is in: 'still here.'",
    "{name} made no sound all day. The silence spoke volumes. Literally — {name} published a paper.",
    "{name} counted your completed quests. Then your incomplete ones. The second number got a longer stare.",
    "{name} flew to a different branch. Not restlessness. Peer review of your choices from a new angle.",
    "{name} discovered a pattern in your quest schedule. {name} is concerned. The pattern is 'last minute.'",
    "{name} brought you a mouse, a leaf, and an acorn. It's a syllabus. You're behind.",
    "{name} sat perfectly still for eight hours. Not meditation. Data collection.",
    "{name} turned its back to you. In owl culture, this means 'I've seen enough.' Or 'there's something behind me.' Both apply.",
    "{name} sorted your gems by color, then by tier, then by 'emotional resonance.' The last category is subjective but {name} is confident.",
    "{name} woke up and chose observation. Again. Every day is observation day. You are the subject.",
    "{name} has seventeen theories about your playstyle. Sixteen are unflattering. The seventeenth is worse.",
    "{name} corrected your grammar in a quest note. You didn't ask. {name} didn't care.",
    "{name} published a monograph on your procrastination patterns. Peer-reviewed by the other companions. They agreed.",
    "{name} knows your password. Not because {name} hacked it. Because you say it out loud every time.",
  ],
  phoenix: [
    "{name} died yesterday. {name} got better. Your excuses can too.",
    "{name} is on fire. As usual. It's a lifestyle, not a problem.",
    "Yesterday was yesterday. {name} already forgot it. Literally.",
    "{name} burst into flames at breakfast. The toast was ruined. {name} was fine.",
    "{name} has died 347 times. Still shows up. You missed one day and called it a 'setback'.",
    "{name} left ashes on the keyboard. Not an accident. A signature.",
    "{name} exploded during dinner. The good news: the food was reheated instantly. The bad news: so was the table.",
    "{name} rose from the ashes. Again. At this point the ashes file the paperwork themselves.",
    "{name} doesn't understand 'giving up'. Not philosophically — the concept literally doesn't translate. {name} tried. Caught fire. Started over.",
    "{name} looked at your broken streak and shrugged. In phoenix culture, 'broken' is just the part before 'reborn'.",
    "{name} is allergic to quitting. Also to water. One of these is more relevant.",
    "{name} set the curtains on fire. By existing. The landlord has stopped sending invoices.",
    "{name}'s last words before combusting were 'watch this.' They always are.",
    "Every morning {name} wakes up and chooses violence. Against entropy. The entropy is losing.",
    "{name} has no concept of failure. Only extremely dramatic pauses between successes.",
    "{name} left a scorch mark shaped like a heart. Or a warning sign. Same shape, different fonts.",
    "{name} warmed your chair. From the inside. The upholstery is a different color now.",
    "{name} molted. Three feathers. Each one caught fire on the way down. The carpet is vintage now.",
    "{name} tried to high-five you. Forgot about the 'being on fire' thing. Your eyebrows will grow back.",
    "{name} combusted spontaneously at lunch. Dessert was crème brûlée. Nobody planned this. Nobody complained.",
    "{name} stared at the sun. The sun looked away. Professional courtesy between things that burn.",
    "{name} tried to take a bath. The water evaporated. {name} considers this a successful bath.",
    "{name} sneezed embers. The bookshelf is fine. The books are fine. The bookmark is a legend now.",
    "{name} perched on the forge. Grimvar asked it to leave. {name} raised the forge temp by existing. Grimvar said stay.",
    "The fire alarm went off. {name} looked offended. It wasn't {name} this time. {name} was offended because someone else got credit.",
    "{name} flew through a rainstorm. Came out dry. The rain came out steam. Physics filed a complaint.",
    "{name} watched you fail a quest. Caught fire immediately. Not anger. Secondhand embarrassment is exothermic.",
    "{name} remembers nothing before last Tuesday. This is not a flaw. It's a feature. History is optional.",
    "{name} winked. While on fire. Style points are not awarded in this system. But if they were.",
    "{name} laid down on the ice. The ice became a lake. The lake became a spa. {name} charges admission now.",
  ],
  wolf: [
    "{name} howled at the moon. It was motivational. The neighbors disagree.",
    "{name} is tracking your progress. {name} is a very patient hunter.",
    "{name} doesn't do pep talks. {name} does silent, intense staring.",
    "{name} circled three times before lying down. Not comfort — perimeter check.",
    "{name} sniffed the air. Smells like unfinished quests. And rain. Mostly unfinished quests.",
    "{name} watched you from across the room for four hours. Not creepy. Tactical.",
    "{name} growled at your notifications. Low. Sustained. The notifications got the message.",
    "{name} led the pack once. Now {name} leads you. The skill set is surprisingly transferable.",
    "{name} brought you a stick. Not a gift. A weapon. For whatever today brings.",
    "{name} is not your friend. {name} is your ally. The difference matters at 3 AM.",
    "{name} marked its territory around your desk. A bold strategy. Nobody sits there anymore.",
    "{name} heard a twig snap outside. Stood guard for six hours. It was the wind. {name} has no regrets.",
    "{name} doesn't wag. {name} acknowledges. It's the same motion, with different intent.",
    "{name} traveled 40 miles in a night. Not for food. To prove a point. The point was unclear but well-traveled.",
    "{name} sleeps with one eye open. The open eye is aimed at your quest list. Always.",
    "{name} yawned. It was threatening. Everything {name} does is slightly threatening. Even sleeping.",
    "{name} tilted its head. This was not cute. This was triangulation.",
    "{name} disappeared for three days. Came back with a scar and better gear. No questions.",
    "{name} sniffed your hand. Decided you were acceptable. The bar was low. You still barely cleared it.",
    "{name} formed a pack hierarchy. You are third. After {name}. And {name}'s shadow. The shadow earned it.",
    "{name} chased nothing through the forest. Came back tired. The nothing is still out there.",
    "{name} sat in the rain without flinching. You complain about cold coffee. Perspective is wild.",
    "{name} heard a howl in the distance. Responded. Started a conversation. You weren't invited.",
    "{name} protected your campfire all night. Not from threats. From going out. The forge temp metaphor writes itself.",
    "{name} trotted ahead on the path. Not leading. Scouting. The difference is survival.",
    "{name} looked at the leaderboard. Then at you. Then walked away. Some data requires processing time.",
    "{name} doesn't fetch. {name} hunts. If you want fetch, get a dog. If you want results, stay.",
    "{name} found a bone. Buried it. Dug it up. Buried it somewhere else. Long-term investment strategy.",
    "{name} stood between you and the door. Not blocking. Suggesting. That the quests are the other way.",
    "{name} licked its paw. Slowly. While maintaining eye contact. Wolves don't do casual.",
  ],
  fox: [
    "{name} found a shortcut. It's probably a trap. {name} took it anyway.",
    "{name} suggests a creative approach. 'Creative' is doing a lot of work there.",
    "{name} grinned. In {name}'s defense, foxes always grin. It's unsettling.",
    "{name} stole your socks. Not because they're useful. Because they were yours and now they're not.",
    "{name} solved your puzzle. Then unsolved it. Then solved it differently. Then looked bored.",
    "{name} rearranged your inventory while you weren't looking. Everything is where it shouldn't be. Everything works better now.",
    "{name} dug three holes. One for treasure. One for escape. One for fun. Guess which is which.",
    "{name} whispered something to the NPC. The NPC's prices dropped. {name} won't explain how.",
    "{name} has seven plans. Plan A is the worst. Plan G is illegal. Plan D is the one that works. {name} always starts with Plan A.",
    "{name} found your hidden stash of 'later' quests. Moved them to 'now'. You're welcome. Or not.",
    "{name} left a trail of breadcrumbs to your quest board. Ate half of them on the way back. Foxes have priorities.",
    "{name} opened a locked door. Without a key. And without telling you there WAS a locked door. Context is for other animals.",
    "{name} tilts its head when you make decisions. Not curiosity. Disbelief.",
    "{name} snuck into the Forge at night. Came back with better gear. Refuses to discuss the details.",
    "{name} observed that 'shortcuts' and 'scenic routes' are the same thing if you're fast enough.",
    "{name} hid your keys. Not malice. Behavioral experiment. You found them faster than expected. {name} adjusted the difficulty.",
    "{name} looked innocent. This is the most dangerous expression a fox can make.",
    "{name} traded your common item for a rare one. You didn't authorize this. You also can't complain.",
    "{name} counted your gold. Twice. The numbers were different each time. Both were correct, somehow.",
    "{name} vanished for an hour. Came back with information. Won't reveal the source. 'A fox never tells' is apparently a real policy.",
    "{name} laughed. Foxes don't laugh. {name} disagrees. It was brief and unsettling.",
    "{name} rearranged your quest priorities. Everything important is now urgent. Everything urgent is now 'too late.' Efficient.",
    "{name} pretended to sleep. You relaxed. {name} stole your sandwich. Espionage has many forms.",
    "{name} drew a map in the dirt. It was actually useful. Then it rained. Timing is everything and {name} has none.",
    "{name} knows where everything is. {name} won't tell you unless you ask the right question. The right question changes daily.",
    "{name} sat where you were about to sit. Not an accident. Territorial negotiations are ongoing.",
    "{name} made friends with the NPC. Somehow got a discount. The NPC looks confused. {name} looks satisfied. As usual.",
    "{name} found a bug in the system. Didn't report it. Uses it. There's a fine line between clever and criminal.",
    "{name} is not sneaky. {name} is 'efficient with visibility.' The vocabulary matters.",
    "{name} yipped at dawn. Once. As a summary of today's plan. You didn't understand it. That's step one.",
  ],
  bear: [
    "{name} woke up. This is a bigger deal than you think.",
    "{name} punched a tree. For motivation. The tree had it coming.",
    "{name} is here. {name} is large. {name} believes in you. Aggressively.",
    "{name} sat on your quest log. Not metaphorically. Literally. It's flat now. So are your priorities.",
    "{name} looked at the Rift. The Rift looked away first.",
    "{name} ate breakfast. All of it. Yours too. Consider it a lesson in preparedness.",
    "{name} tried to fit through a doorway. Modified the doorway. Didn't ask.",
    "{name} hibernated for six hours in the middle of the day. Woke up stronger. You napped for twenty minutes and woke up confused. Different species, different results.",
    "{name} gave you a look. The look said: 'I could solve all your problems. But then you wouldn't learn.' {name} went back to sleep.",
    "{name} stood up on hind legs. Not to intimidate — to get a better view of your quest board. The intimidation was free.",
    "{name} is quiet today. Not calm. Loading.",
    "{name} scratched a tree. Not an itch. A warning. To the tree. And to your procrastination.",
    "{name} caught a fish. Ate it raw. Looked at you eating toast. The judgment was mutual.",
    "{name} hugged you. Gently, by bear standards. You still couldn't breathe for thirty seconds. Love is complicated.",
    "{name} doesn't understand small talk. {name} understands large talk. And silence. Mostly silence.",
    "{name} yawned so wide you could see its tonsils. This is either trust or a warning. Both are valid.",
    "{name} leaned on you. Two hundred kilograms of 'gentle.' Your spine filed a formal objection.",
    "{name} stole honey from the kitchen. Not subtly. The jar is gone. The shelf is gone. The kitchen is remodeled.",
    "{name} rolled in the grass. Flattened the grass. Flattened some flowers. Flattened the concept of 'delicate.'",
    "{name} swam. The river changed direction. Temporarily. The fish are still in therapy.",
    "{name} snored. The windows rattled. The neighbors filed a noise complaint. Against an earthquake. They were wrong. It was {name}.",
    "{name} found berries. Ate all the berries. Looked at your lunch. Ate your lunch. Looked at your backup lunch. You don't have one anymore.",
    "{name} played with a log. The log lost. The log always loses. Logs are zero and {name} keeps score.",
    "{name} climbed a tree. The tree bent. The tree survived. The tree has trust issues now.",
    "{name} gave you a fish. Not as food. As a test. You cooked it. {name} watched. {name} learned something about you today.",
    "{name} stood in the doorframe. The doorframe is the right size for humans. {name} is not human. Architecture is a suggestion.",
    "{name} made a noise. Not a growl. Not a purr. Something in between that science hasn't named yet. You felt it in your bones.",
    "{name} napped in the sun. For six hours. Woke up. Stretched. Went back to sleep. Productivity is a spectrum.",
    "{name} looked at the mountain. The mountain looked back. An understanding was reached. You were not part of the negotiation.",
    "{name} is protecting you. From what? From everything. Especially from the decisions you'd make without supervision.",
  ],
  hamster: [
    "{name} ran on the wheel for an hour. Made zero progress. Felt accomplished. There's a lesson here.",
    "{name} stuffed 14 sunflower seeds into its cheeks. A storage strategy you should consider for your quests.",
    "{name} escaped the cage. Again. Found in the kitchen. Near the snacks. Shocking.",
    "{name} built a nest out of your to-do list. Priorities were assessed. The nest won.",
    "{name} is tiny but has opinions. Loud ones. At 2 AM. About nothing in particular.",
    "{name} bit the cage bars. Not frustration. Communication. You should have listened.",
    "{name} runs. Constantly. Toward nothing. Away from nothing. The philosophy is advanced.",
    "{name} hoarded bedding material under the food bowl. Inefficient? Yes. Committed? Absolutely.",
    "{name} froze in place for ten seconds. Not cute. Loading. Hamsters buffer differently.",
    "{name} chewed through the cardboard tube. Not escape. Renovation. The tube is now open-concept.",
    "{name} washed its face with both paws. Sixteen times. Hygiene or procrastination? The line blurs.",
    "{name} stood on hind legs. Surveying. The empire is small but well-managed.",
    "{name} buried a treat, forgot where, found it, buried it again. The cycle of life is 45 seconds long.",
    "{name} squeaked once. Meaning: everything. The squeak contains multitudes.",
    "{name} is nocturnal. You are not. This is a scheduling conflict neither of you will resolve.",
  ],
  bird: [
    "{name} sang at dawn. Beautifully. For thirty seconds. Then screamed. The duality of nature.",
    "{name} repeated your last excuse back to you. In a higher pitch. With more conviction.",
    "{name} rearranged the seeds into a pattern. It means something. Probably 'feed me'. Possibly 'do your quests'.",
    "{name} flew into the window. Twice. Still more progress than your quest log.",
    "{name} learned a new word. The word is 'no'. {name} uses it liberally.",
    "{name} is perched on the monitor. Supervising. The supervision is non-negotiable.",
    "{name} plucked a feather and left it on your keyboard. A gift. Or a threat. Context is unclear.",
    "{name} mimicked the notification sound. Perfectly. You checked your phone twelve times. {name} is entertained.",
    "{name} rang the bell in the cage. Not playtime. A summons. You are late. For something.",
    "{name} preened for forty-five minutes. Not vanity. Maintenance. {name} has standards. You have a hoodie.",
    "{name} bobbed its head rhythmically. Not music. Counting. Your incomplete quests. The number grows.",
    "{name} chirped at the ceiling. The ceiling didn't respond. {name} chirped louder. Negotiations are ongoing.",
    "{name} ate millet and judged you simultaneously. Multitasking is a bird specialty.",
    "{name} sat on your head. Not affection. Elevation. The view is better up here.",
    "{name} said 'hello' to itself in the mirror. Confidence, or loneliness? Both. Always both.",
  ],
  fish: [
    "{name} swam in circles. Still more direction than your quest planning.",
    "{name} opened and closed its mouth. Not talking. Judging. Fish judge vertically.",
    "{name} stared through the glass. At you. For six hours. Fish don't blink. Neither does disappointment.",
    "{name} ate a flake. Then another. Then waited. Patience is a fish virtue. And a taunt.",
    "{name} hid behind the castle decoration. Not scared. Strategic. Fish understand cover.",
    "{name} blew a bubble. It popped. Like your plans for productivity. But prettier.",
    "{name} ignored you completely. In fish culture, this is considered a compliment.",
    "{name} swam to the surface. Looked at you. Sank. Commentary delivered. Commentary received.",
    "{name} rearranged the gravel. Interior design happens at all scales.",
    "{name} is at the bottom of the tank. Not sad. Grounding. Fish invented mindfulness. Nobody credits them.",
    "{name} ate the same food at the same time as yesterday. Routine is not boring when you're a fish. It's religion.",
    "{name} darted left. Then right. Then left again. Not panic. Dance. You lack the context to appreciate it.",
    "{name} pressed its face against the glass. Not love. Surveillance. {name} monitors your screen from the tank.",
    "{name} has been alive for three years. In fish years that's... also three years. But with more water.",
    "{name} made no sound. As always. The quietest companion. The loudest judgment.",
  ],
  rabbit: [
    "{name} thumped. Once. Firmly. The message was received. The message was: 'faster.'",
    "{name} ate your homework. {name} doesn't understand what homework is. That's not the point.",
    "{name} dug a tunnel under the couch. Strategic retreat or escape plan — depends on your quest completion rate.",
    "{name} binkied. Uncontrollable joy for no reason. You should try it. You won't. But you should.",
    "{name} sits perfectly still. Not calm. Calculating. Rabbits calculate at speeds you can't comprehend.",
    "{name} nudged your hand. For pets? For attention? No. To move you toward the quest board.",
    "{name} has sixteen backup hiding spots. For each one, {name} has a backup backup. Rabbits plan ahead. You don't.",
    "{name} chewed through a cable. Not yours. The important one. The replacement cost is character development.",
    "{name} flopped on its side dramatically. Not dead. Relaxed. There's no in-between with rabbits.",
    "{name} stood on the couch arm. Surveying the room. Mapping exits. Always mapping exits.",
    "{name} twitched its nose 4,000 times today. Each twitch was a micro-judgment. You passed 3,200 of them.",
    "{name} hopped onto your desk. Left three droppings. Moved on. Art is provocative.",
    "{name} ate hay for forty minutes straight. Focus like that can't be taught. It can only be witnessed.",
    "{name} licked your hand. Salt extraction. Not affection. You're a mineral source.",
    "{name} thumped again. Different thump. This one means 'the quest board.' You're learning.",
  ],
  other: [
    "Your companion watches. Not with judgment. With something worse: understanding.",
    "Today is a day. That's all the motivation you're getting. From anyone.",
    "Your companion made a list. It's longer than yours. It's always longer than yours.",
    "Your companion looked at your quest log and sighed. Companions don't sigh. Except when they do.",
    "Your companion is here. That's more than most can say about their plans.",
    "Something stirred in the corner. It was your companion. And your conscience. Same direction.",
    "Your companion has been awake longer than you. Your companion will outlast you. This is not a competition. You're losing anyway.",
  ],
  default: [
    "Your companion watches. Patiently. The patience is aggressive.",
    "Today is a day. That's all the motivation you're getting.",
    "Your companion made a list. It's longer than yours.",
    "Your companion looked at your streak counter and said nothing. The silence was deafening.",
    "Your companion nudges the quest board. Subtlety has never been its strength.",
    "Your companion is here. Your excuses are not. One of you showed up.",
    "Your companion tilted its head. Not in confusion. In slow, theatrical disbelief.",
  ],
};

// ─── Streak urgency (only shows when at-risk) ──────────────────────────────
function getStreakUrgency(streak: number, streakLastDate?: string | null, user?: User | null): {
  show: boolean; label: string; color: string;
} {
  if (streak < 3) return { show: false, label: "", color: "" };
  const now = new Date();
  const berlinNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const todayStr = `${berlinNow.getFullYear()}-${String(berlinNow.getMonth() + 1).padStart(2, "0")}-${String(berlinNow.getDate()).padStart(2, "0")}`;
  if (streakLastDate === todayStr) return { show: false, label: "", color: "" }; // Safe today
  // Check if streak is protected (shield or charm)
  const ext = (user ?? {}) as unknown as Record<string, unknown>;
  const shields = (ext.streakShields as number) || 0;
  if (shields > 0) {
    return { show: true, label: `${streak}d streak — ${shields} shield${shields > 1 ? "s" : ""} armed`, color: "#3b82f6" };
  }
  // At risk — show warning
  return { show: true, label: `${streak}d streak at risk!`, color: "#ef4444" };
}

// ─── DailyHub Component ─────────────────────────────────────────────────────
// Slim action bar: Daily Bonus + Streak Warning + Today Drawer trigger.
// Detail lives in TodayDrawer — DailyHub is the quick-glance + quick-act layer.

interface DailyHubProps {
  user: User;
  dailyBonusAvailable: boolean;
  onClaimDailyBonus: () => void;
  claimingDailyBonus: boolean;
  dailyMissions: {
    missions: { id: string; label: string; points: number; done: boolean }[];
    earned: number;
    total: number;
    milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[];
  } | null;
  questsCompletedToday: number;
  onNavigate: (view: string) => void;
  onTodayOpen: () => void;
}

export const DailyHub = memo(function DailyHub({
  user,
  dailyBonusAvailable,
  onClaimDailyBonus,
  claimingDailyBonus,
  dailyMissions,
  questsCompletedToday,
  onNavigate,
  onTodayOpen,
}: DailyHubProps) {
  const streak = user.streakDays ?? 0;
  const streakUrgency = getStreakUrgency(streak, user.streakLastDate, user);
  const playerLevel = getUserLevel(user.xp ?? 0).level;
  const nextUnlock = playerLevel < 15 ? getNextUnlock(playerLevel) : null;
  const nextMilestone = dailyMissions?.milestones.find(m => !m.claimed && dailyMissions.earned >= m.threshold);
  const forgeTemp = Math.min(user.forgeTemp ?? 0, 100);
  const forgeCold = forgeTemp < 40 && forgeTemp > 0; // Forge is cooling — loss prevention trigger

  // Companion daily quote (deterministic per day)
  const companionQuote = useMemo(() => {
    const comp = user.companion;
    if (!comp) return null;
    const type = comp.type ?? "default";
    const name = comp.name ?? "Companion";
    const quotes = COMPANION_DAILY_QUOTES[type] ?? COMPANION_DAILY_QUOTES.default;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % quotes.length;
    return quotes[idx].replace(/\{name\}/g, name);
  }, [user.companion]);

  // Greeting based on time of day + streak status (Berlin)
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin", hour: "numeric", hour12: false }), 10);
    const s = user.streakDays ?? 0;
    // Streak-aware greetings (Skulduggery tone)
    if (s >= 100) { setGreeting(h >= 22 || h < 6 ? "Still here?" : "The usual"); return; }
    if (s >= 30) { setGreeting(h >= 22 || h < 6 ? "Night shift" : "Day " + s); return; }
    if (h >= 5 && h < 12) setGreeting("Good morning");
    else if (h >= 12 && h < 18) setGreeting("Good afternoon");
    else if (h >= 18 && h < 22) setGreeting("Good evening");
    else setGreeting("Night owl mode");
  }, []);

  // Only render if there's something actionable to show
  const hasAction = dailyBonusAvailable || streakUrgency.show || forgeCold || nextMilestone || (user._restedXpPool ?? 0) > 50;
  // Always show for new players (< Lv5) or when companion has a quote
  const showHub = hasAction || playerLevel < 5 || !!companionQuote;
  if (!showHub) return null;

  return (
    <div
      className="rounded-xl overflow-hidden tab-content-enter"
      style={{
        background: "linear-gradient(135deg, rgba(17,19,24,0.95), rgba(26,28,35,0.9))",
        border: `1px solid ${streakUrgency.show ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: streakUrgency.show ? "0 0 20px rgba(239,68,68,0.1)" : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Greeting (compact) */}
        <p className="text-sm font-semibold flex-shrink-0" style={{ color: "#e8e8e8" }}>
          {greeting}, <span style={{ color: user.color ?? "#a78bfa" }}>{user.name}</span>
        </p>

        {/* Daily mission mini-progress (click opens Today Drawer) */}
        {dailyMissions && (() => {
          const done = dailyMissions.missions.filter(m => m.done).length;
          const total = dailyMissions.missions.length;
          const allDone = done >= total;
          return (
            <button onClick={onTodayOpen} className="text-xs px-2 py-0.5 rounded-md flex-shrink-0 inline-flex items-center gap-1" style={{ background: allDone ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)", color: allDone ? "#22c55e" : "rgba(255,255,255,0.3)", border: `1px solid ${allDone ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }} title={`Daily missions: ${done}/${total} — click to open Today`}>
              {allDone ? "✓" : `${done}/${total}`} Daily
            </button>
          );
        })()}

        {/* Streak Warning — only when at risk */}
        {streakUrgency.show && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded streak-urgent-pulse flex-shrink-0 inline-flex items-center gap-1" style={{ color: streakUrgency.color, background: `${streakUrgency.color}15`, border: `1px solid ${streakUrgency.color}30` }}>
            <span className={`streak-mini-flame${streak >= 30 ? " epic" : ""}`} />
            {streakUrgency.label}
          </span>
        )}

        {/* Forge Cold Warning — loss prevention */}
        {forgeCold && !streakUrgency.show && (
          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: "#78716c", background: "rgba(120,113,108,0.1)", border: "1px solid rgba(120,113,108,0.2)" }}>
            Forge cooling ({forgeTemp}%)
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Rested XP badge */}
        {(user._restedXpPool ?? 0) > 50 && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
            ★ {Math.round(user._restedXpPool!)} Rested XP
          </span>
        )}

        {/* Next unlock badge */}
        {nextUnlock && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${nextUnlock.color}10`, color: `${nextUnlock.color}99`, border: `1px solid ${nextUnlock.color}25` }}>
            Lv.{nextUnlock.level}: {nextUnlock.features.join(", ")}
          </span>
        )}

        {/* Unclaimed milestone nudge */}
        {nextMilestone && !dailyBonusAvailable && (
          <button onClick={onTodayOpen} className="text-xs font-mono px-2 py-1.5 rounded flex-shrink-0" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)", cursor: "pointer" }} title="Claim milestone in Today's Overview">
            Claim ★
          </button>
        )}

        {/* Today Drawer trigger */}
        <button
          onClick={onTodayOpen}
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
          title="Open detailed Today overview"
        >
          Today ↗
        </button>

        {/* Daily Bonus Claim — the primary action with streak tier preview */}
        {dailyBonusAvailable && (() => {
          const streak = user.streakDays ?? 0;
          const tier = streak >= 30 ? { label: "30d+", extra: "+3 Rune +5 Essenz", color: "#f97316" }
            : streak >= 14 ? { label: "14d+", extra: "+2 Rune +2 Essenz", color: "#a855f7" }
            : streak >= 7 ? { label: "7d+", extra: "+1 Rune +1 Essenz", color: "#3b82f6" }
            : null;
          return (
            <button
              onClick={onClaimDailyBonus}
              disabled={claimingDailyBonus}
              className="px-4 py-1.5 rounded-lg text-xs font-bold daily-bonus-glow flex-shrink-0 inline-flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.15))",
                color: "#fbbf24",
                border: "1px solid rgba(251,191,36,0.4)",
                cursor: claimingDailyBonus ? "not-allowed" : "pointer",
                opacity: claimingDailyBonus ? 0.6 : 1,
                animation: !claimingDailyBonus ? "daily-bonus-pulse 2s ease-in-out infinite" : "none",
              }}
              title={tier ? `Daily Bonus — streak tier ${tier.label}: base + ${tier.extra}` : "Claim your daily login bonus (2 Rune + 3 Essenz)"}
            >
              {claimingDailyBonus ? "Claiming..." : "Claim Daily Bonus"}
              {tier && !claimingDailyBonus && (
                <span className="text-xs font-normal px-1 py-0.5 rounded" style={{ background: `${tier.color}20`, color: tier.color, fontSize: 10 }}>
                  {tier.label}
                </span>
              )}
            </button>
          );
        })()}
      </div>
      {/* Companion message — unique to DailyHub, not in TodayDrawer */}
      {companionQuote && (
        <div className="px-4 pb-2 -mt-0.5">
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>
            &ldquo;{companionQuote}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
});
