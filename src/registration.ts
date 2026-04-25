import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard, Keyboard } from "grammy";
import { Gender } from "@prisma/client";
import { prisma } from "../server/lib/prisma"; // Use the singleton
import { MyContext, mainMenuKeyboard } from "./bot";
import { regions, districts } from "./data/locations";

export type MyConversation = Conversation<MyContext>;

export async function registrationFlow(conversation: MyConversation, ctx: MyContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply("❌ Could not identify your Telegram account. Please try /start again.");
    return;
  }

  // Guard: Check if already registered BEFORE asking any questions
  const existingUser = await conversation.external(() =>
    prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } })
  );

  if (existingUser) {
    await ctx.reply("✅ You are already registered! Use the menu below to explore.", {
      reply_markup: mainMenuKeyboard,
    });
    return;
  }

  // 1. Full Name
  await ctx.reply("Welcome! 🎓 Let's get you registered.\n\nPlease enter your *Full Name*:", {
    parse_mode: "Markdown",
  });
  let fullName = "";
  while (true) {
    const nameCtx = await conversation.waitFor("message:text");
    const text = nameCtx.message.text.trim();
    if (text.length >= 2 && text.length <= 100) {
      fullName = text;
      break;
    }
    await ctx.reply("❗ Please enter a valid full name (2–100 characters):");
  }

  // 2. Phone
  const phoneKeyboard = new Keyboard().requestContact("📱 Share Contact").resized().oneTime();
  await ctx.reply("Please share your phone number by clicking the button below:", {
    reply_markup: phoneKeyboard,
  });
  let phone = "";
  while (true) {
    const phoneCtx = await conversation.waitFor("message");
    if (phoneCtx.message?.contact) {
      phone = phoneCtx.message.contact.phone_number;
      break;
    }
    await ctx.reply("❗ Please use the 'Share Contact' button to share your phone number.", {
      reply_markup: phoneKeyboard,
    });
  }

  // 3. Age
  await ctx.reply("Please enter your *age* (e.g., 16):", {
    reply_markup: { remove_keyboard: true },
    parse_mode: "Markdown",
  });
  let age = 0;
  while (true) {
    const ageCtx = await conversation.waitFor("message:text");
    const parsedAge = parseInt(ageCtx.message.text.trim(), 10);
    if (!isNaN(parsedAge) && parsedAge >= 5 && parsedAge <= 100) {
      age = parsedAge;
      break;
    }
    await ctx.reply("❗ Please enter a valid age (between 5 and 100):");
  }

  // 4. Gender — uses Prisma Gender enum values
  const genderKeyboard = new InlineKeyboard()
    .text("Male 👦", "gender_MALE")
    .text("Female 👧", "gender_FEMALE");
  await ctx.reply("Please select your gender:", { reply_markup: genderKeyboard });

  let gender: Gender = Gender.MALE;
  while (true) {
    const updateCtx = await conversation.waitFor(["callback_query:data", "message"]);
    if (updateCtx.hasCallbackQuery(["gender_MALE", "gender_FEMALE"])) {
      await updateCtx.answerCallbackQuery();
      gender = updateCtx.callbackQuery.data === "gender_MALE" ? Gender.MALE : Gender.FEMALE;
      await updateCtx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
      break;
    }
    if (updateCtx.message) {
      await ctx.reply("❗ Please select your gender using the buttons above.");
    }
  }

  // 5. Region Selection
  const regionKeyboard = new InlineKeyboard();
  regions.forEach((r, index) => {
    regionKeyboard.text(r.name, `region_${r.id}`);
    if ((index + 1) % 2 === 0) regionKeyboard.row();
  });

  await ctx.reply("Please select your *Region*:", { 
    reply_markup: regionKeyboard,
    parse_mode: "Markdown" 
  });

  let selectedRegionId = 0;
  let regionName = "";
  while (true) {
    const regionCtx = await conversation.waitFor("callback_query:data");
    if (regionCtx.callbackQuery.data.startsWith("region_")) {
      selectedRegionId = parseInt(regionCtx.callbackQuery.data.replace("region_", ""), 10);
      regionName = regions.find(r => r.id === selectedRegionId)?.name || "";
      await regionCtx.answerCallbackQuery();
      await regionCtx.editMessageText(`✅ Selected Region: *${regionName}*`, { parse_mode: "Markdown" });
      break;
    }
  }

  // 6. District Selection (Filtered by Region)
  const filteredDistricts = districts.filter(d => d.regionId === selectedRegionId);
  const districtKeyboard = new InlineKeyboard();
  filteredDistricts.forEach((d, index) => {
    districtKeyboard.text(d.name, `district_${d.id}`);
    if ((index + 1) % 2 === 0) districtKeyboard.row();
  });

  await ctx.reply(`Please select your *District* in ${regionName}:`, { 
    reply_markup: districtKeyboard,
    parse_mode: "Markdown" 
  });

  let districtName = "";
  while (true) {
    const districtCtx = await conversation.waitFor("callback_query:data");
    if (districtCtx.callbackQuery.data.startsWith("district_")) {
      const districtId = parseInt(districtCtx.callbackQuery.data.replace("district_", ""), 10);
      districtName = filteredDistricts.find(d => d.id === districtId)?.name || "";
      await districtCtx.answerCallbackQuery();
      await districtCtx.editMessageText(`✅ Selected District: *${districtName}*`, { parse_mode: "Markdown" });
      break;
    }
  }

  // 7. MFY (Mahalla)
  await ctx.reply("Please enter your *MFY* (Mahalla name):", { parse_mode: "Markdown" });
  let mfy = "";
  while (true) {
    const mfyCtx = await conversation.waitFor("message:text");
    if (mfyCtx.message.text.trim().length > 1) {
      mfy = mfyCtx.message.text.trim();
      break;
    }
    await ctx.reply("❗ Please enter a valid MFY name:");
  }

  // 8. Street
  await ctx.reply("Please enter your *Street* name:", { parse_mode: "Markdown" });
  let street = "";
  while (true) {
    const streetCtx = await conversation.waitFor("message:text");
    if (streetCtx.message.text.trim().length > 1) {
      street = streetCtx.message.text.trim();
      break;
    }
    await ctx.reply("❗ Please enter a valid Street name:");
  }

  // 9. House Number
  await ctx.reply("Please enter your *House Number*:", { parse_mode: "Markdown" });
  let house = "";
  while (true) {
    const houseCtx = await conversation.waitFor("message:text");
    if (houseCtx.message.text.trim().length > 0) {
      house = houseCtx.message.text.trim();
      break;
    }
    await ctx.reply("❗ Please enter a valid House Number:");
  }

  // Finalization: Save to Prisma using correct schema fields
  const loadingMessage = await ctx.reply("⏳ Saving your details, please wait...");

  const webAppUrl = `${process.env.WEBAPP_URL}?gender=${gender.toLowerCase()}`;
  
    // Prepare result message (handle HTTPS requirement)
    let finalMessage = "✅ <b>Registration complete!</b> Click the button below to launch the App.";
    if (!webAppUrl.startsWith('https://')) {
      finalMessage += `\n\n⚠️ <b>Note</b>: Your Web App URL is not HTTPS. Telegram requires HTTPS for the native "Launch" button.\n\n🔗 <b>Direct Link</b>:\n<code>${webAppUrl}</code>`;
    }

  try {
    // conversation.external() ensures Prisma calls run correctly inside the grammY conversation engine
    await conversation.external(() =>
      prisma.user.create({
        data: {
          telegramId: BigInt(telegramId), // Strict BigInt as per schema
          fullName,
          phone,
          age,
          gender,   // Uses Prisma enum: Gender.MALE | Gender.FEMALE
          region: regionName,
          district: districtName,
          mfy,
          street,
          house,    // Correct field name from schema
        },
      })
    );

    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMessage.message_id,
      finalMessage,
      { parse_mode: "HTML" }
    );
    await ctx.reply("🎊 Profile initialized! Use the menu below to navigate.", {
      reply_markup: mainMenuKeyboard
    });
  } catch (error: any) {
    console.error("Prisma Error during registration:", error);
    if (error.code === "P2002") {
      let duplicateMessage = "✅ You are already registered!";
      let duplicateKeyboard: InlineKeyboard | undefined;

      if (webAppUrl.startsWith('https://')) {
        duplicateKeyboard = new InlineKeyboard().webApp("Launch Test 🚀", webAppUrl);
        duplicateMessage += " Click the button below to launch the App.";
      } else {
        duplicateMessage += `\n\n⚠️ <b>Note</b>: Your Web App URL is not HTTPS.\n\n🔗 <b>Direct Link</b>:\n<code>${webAppUrl}</code>`;
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMessage.message_id,
        duplicateMessage,
        { reply_markup: duplicateKeyboard, parse_mode: "HTML" }
      );
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMessage.message_id,
        "❌ A server error occurred. Please try /start again in a few minutes."
      );
    }
  }
}
