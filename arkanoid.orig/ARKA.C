//Arkanoid
//arka.c
//Philip Brocoum

/*
directions
X quits
left mouse button fires lasers
left mouse button starts game and starts new life after a ball is lost
*/

#include <allegro.h>
#include <stdlib.h> //for rand()
#include <time.h>
#include <pc.h> //for sound()

//define the powerups
#define STICK 1
#define FAST 2
#define LASER 3
#define LONG 6
#define LIFE 7
#define WARP 8
#define POINTS 5
#define CONTROL 4
#define ABOVE 9

typedef struct block
{
   int x, y;
   int there;
   //int color; different color blocks give diff powerups (not implemented)
} block;

char poweruptext[20]; //powerup notification text
int ptexty; //location of powerup notifier
int powone; //first powerup for above powerup
int lasery; //how high the laser shoots
int shoot; //1 if player is shooting laser
int paddlewidth; //width of paddle
int stuck; //stick powerup variable
int capsule; //the powerup capsule
int capx, capy; //powerup capsule coords
int thepower; //stores what powerup is active
int numhit; //number of blocks hit
int bx, by; //ball x and y coords
int dead; //player state
int bvx, bvy; //ball velocities
int powertime; //controls how long power is on
int px; //paddle coord (only need one)
//int pw; //paddle width for longer paddle powerup (maybe)
//int laser; flag for laser powerup (maybe)
int score; //player score
int level; //level
int lives; //player lives
char infotext[30]; //stores info for screen output like score, lvl, etc.
block blocks[150]; //the blocks
RGB palt[256]; //game pallete
BITMAP *background; //background bmp
BITMAP *paddle; //paddle bmp
BITMAP *ball; //ball bmp
BITMAP *theblock; //block bmp
BITMAP *buffer;  //i'll just do double-buffering, it's easy
BITMAP *capsulebmp;

//keep game running at good speed
volatile int speed_counter=0;

void increment_speed_counter()
      {
         speed_counter++;
      }

END_OF_FUNCTION(increment_speed_counter);

void powerup(int pwr);
void init(void);
void mouse(void);
void moveball(void);
void draw(void);
void nextlevel(void);

int main()
{
   allegro_init(); //init allegro stuff...
   init(); //init game stuff
   install_mouse();
   install_keyboard();
   install_timer();
   set_gfx_mode(GFX_VGA, 320, 200, 320, 200);
   set_pallete(palt);

   LOCK_VARIABLE(speed_counter);
   LOCK_FUNCTION(increment_speed_counter);
   install_int_ex(increment_speed_counter, BPS_TO_TIMER(30));

   //wait for mouse press before starting and play the demo
   speed_counter=0;
   while(!(mouse_b & 1))
   {
      while (speed_counter > 0){	
      px = bx-5;
      moveball();
      speed_counter--;}
      draw();
      textout_centre(screen, font, "DEMO", 160, 100, 1);
   }
   init();

   speed_counter=0;
   while(!key[KEY_X] && lives >= 0) //start game loop
   {
      while (speed_counter > 0) {
      mouse();
      powerup(0);
      moveball();
      speed_counter--;}
      draw();
   }
   nosound();
   return 0;
}

void draw()
{
   int i;
   //draw background
   clear(buffer);
   blit(background, buffer, 0, 0, 0, 0, 320, 200);
   //draw existing blocks
   for(i=0; i<150; i++)
   {
      if(blocks[i].there == 1)
      {
         blit(theblock, buffer, 0, 0, blocks[i].x, blocks[i].y, 10, 5);
      }
   }
   //draw paddle
   if (shoot == 1)
   {
      vline(buffer, px+(paddlewidth/2), 195, lasery, 3);
   }
   sprintf(infotext, "Score: %d, Level: %d, Lives: %d", score, level, lives);
   textout(buffer, font, infotext, 0, 0, 1);
   draw_sprite(buffer, paddle, px, 193);
   draw_sprite(buffer, paddle, px+paddlewidth-20, 193);
   draw_sprite(buffer, capsulebmp, capx, capy);
   draw_sprite(buffer, ball, bx, by);
   textout_centre(buffer, font, poweruptext, 160, ptexty, 1);
   blit(buffer, screen, 0, 0, 0, 0, 320, 200);
}

void mouse()
{
   //paddle position corresponds to mouse position
   px = mouse_x;
   if((px+paddlewidth) > 320) px = 320-paddlewidth;
}

void moveball()
{
   int i;
   int done =0;
   int hit = 0;
   nosound();
   //test for collision with a block
   for (i=0; i<= 149; i++)
   {
      if (blocks[i].there == 1 && done != 1)
      {
         //test for collisions
         if (bx+2 >= blocks[i].x && bx+2 <= blocks[i].x+10 && by+2 >= blocks[i].y && by+2 <= blocks[i].y+5)
                {
                     sound(400);
                     if(thepower != CONTROL) bvy *= -1;
                     blocks[i].there = 0;
                     score += 7;
                     done = 1;
                     numhit += 1;
                     //make sure the speed didn't make ball jump over a block
                      //and hit something it couldn't have hit

                      //actually, this bug fix does NOT work
                      if(i >= 30 && i < 120)
                      {
                           if(blocks[i+30].there == 1 && blocks[i-30].there == 1)
                           {
                                 blocks[i].there = 1;
                                 if(bvy > 0)
                                 {
                                    blocks[i-30].there = 0;
                                 }
                                 else
                                 {
                                    blocks[i+30].there = 0;
                                 }
                                 score -= 7;
                           }
                      }
                      //see if powerup comes
                      if( (rand() % 25) == 1)
                      {
                        powerup(1);
                      }

                 }
      }
   }
   //test for collision with edge of screen
   if(bx <= 9)
   {
      sound(300);
      bvx *= -1;
      bx += 5;
   }
   if(bx >= 305)
   {
      sound(300);
      bvx *= -1;
      bx -= 5;
   }
   if(by <= 0) bvy *= -1;
   //test for paddle collision
   if(by >= 190)
   {
      if(bx+2 > px && bx+2 < (px+paddlewidth))
      {
             if(bx+2 < (px+5))
             {
                  //speed up and slow down ball according to where it hits
                  bvx -= 1;
             }
             if(bx+2 > (px+paddlewidth-5))
             {
                  bvx += 1;
             }
             bvy *= -1;
             if (thepower != STICK) sound(500);
      }
      else
      //you die
      {
             lives -= 1;
             bx = 160;
             by = 100;
             bvy = -5;
             nosound();
             while (!(mouse_b & 1))
             {
               draw();
               mouse();
             }
             speed_counter=0;
      }
   }
   //adjust ball coords
   bx += bvx;
   by += bvy;
   if (numhit >= 145) nextlevel();
}


void init()
{
   int i, x, y;
   powertime = 0;
   stuck = 0;
   //init player stuff
   powone = 0;
   ptexty = 201; //off screen
   capx = -20; //capsule is off screen
   paddlewidth = 20;
   thepower = 0;
   shoot = 0; //not shooting laser
   lasery = 195;
   score = 0;
   level = 1;
   dead = 0;
   px = 140;
   lives = 5;
   //init ball coords
   bx = 160;
   by = 100;
   bvx = 3;
   bvy = -5;
   //init random number generator
   srand(time(NULL));
   //init bmps
   capsulebmp = create_bitmap(20, 5);
   capsulebmp = load_bmp("capsule.bmp", palt);
   background = create_bitmap(320, 200);
   background = load_bmp("backg.bmp", palt);
   paddle = create_bitmap(20, 5);
   paddle = load_bmp("paddle.bmp", palt);
   ball = create_bitmap(5, 5);
   ball = load_bmp("ball.bmp", palt);
   theblock = create_bitmap(10, 5);
   theblock = load_bmp("block.bmp", palt);
   buffer = create_bitmap(320, 200);
   clear(buffer);
   x=10;
   y=20;
   //initialize all the blocks's positions...
   numhit = 0;
   for (i=0; i<150; i++)
   {
      blocks[i].x = x;
      blocks[i].y = y;
      blocks[i].there = 1;
      x+= 10;
      if(x > 300)
      {
         x = 10;
         y += 5;
      }
   }
   speed_counter=0;
}

void powerup(int pwr)
{
   int i;
   int done = 0; //done with loop
   shoot = 0; //lasers
   if(pwr == 1)
   {
      //decide what powerup the capsule holds
      capsule = rand() % 9 + 1;
      capx = bx;
      capy = by;
      if (powone == 0)
      {
         //first capsule is always ABOVE because otherwise it's useless
         capsule = ABOVE;
         powone = 1;
      }
   }
   if(capsule == 0)
   {
      //capsule off the screen
      capx = -20;
      capy = 0;
   }
   if(capy > 190 && capy < 205 && (capx+5) >= px && (capx+5) <= px+paddlewidth)
   {
      //capsule has been gotten
      thepower = capsule;
      capsule = 0;
      score += 20;
      powertime = 0;
      ptexty = 0;
   }
   if(thepower == LONG)
   {
      paddlewidth += 20; //make paddle longer
      if(bvy == 0) bvy = -6;
      thepower = 0;
      sprintf(poweruptext, "EXTENDED PADDLE");
   }
   if (thepower == STICK)
   {
      paddlewidth = 20;
      if((by > 180 && bx >= px && bx <= (px+paddlewidth)) || stuck == 1)
      {
         //if ball hits paddle make it stuck
         stuck = 1;
         bx = px+(paddlewidth/2);
         by = 190;
         bvy = 0;
         nosound(); //fix for bug where sound stayed on forever
         if(mouse_b & 1)
         {
            by = 185;
            stuck = 0;
            bvy = -6;
         }
      }
      if (powertime > 900) thepower = 0;//powerup only during correct time
      sprintf(poweruptext, "STICKY PADDLE");
   }
   if (thepower == CONTROL)
   {
      paddlewidth = 20;
      if(powertime > 300)
      {
         thepower = 0;
      }
      bx = px+(paddlewidth/2);  //ball is where paddle is
      sprintf(poweruptext, "BALL CONTROL");
   }
   if (thepower == POINTS)
   {
      score += 1000;
      thepower = 0;
      sprintf(poweruptext, "MORE SCORE");
   }
   if (thepower == FAST)
   {
      bvx *= 3;//increase ball speed
      thepower = 0;
      sprintf(poweruptext, "FASTBALL");
   }
   if (thepower == LIFE)
   {
      lives += 3;//add lives
      thepower = 0;
      sprintf(poweruptext, "EXTRA LIVES");
   }
   if (thepower == ABOVE)
   {
      by = 10;//move ball above all the blocks
      thepower = 0;
      sprintf(poweruptext, "TELEPORT");
   }
   if (thepower == LASER)
   {
      paddlewidth = 20;
      if (mouse_b & 1)//if mouse button pressed, shoot lasers
      {
         shoot = 1;
         for (i=149; i>= 0; i--)
         {
          if (blocks[i].there == 1 && done != 1)
             {
               //test for laser hits
               if (px+(paddlewidth/2) >= blocks[i].x && px+(paddlewidth/2) <= blocks[i].x+10)
                  {
                     blocks[i].there = 0;
                     score += 7;
                     lasery = blocks[i].y;
                     numhit++;
                     done = 1;
                  }
             }
         }
      }
      if (powertime > 300)
      {
         thepower = 0;
         shoot = 0;
      }
      sprintf(poweruptext, "LASERS");
   }
   if (thepower == WARP)
   {
      nextlevel();//nextlevel
      thepower = 0;
      sprintf(poweruptext, "WARP");
   }
   capy += 1;//capsule slowly falls down the screen
   if (powertime > 900) paddlewidth = 20;//stop extended paddle powerup
   powertime++;//increment powerup time
   ptexty++;//make powerup notification text cascade down the screen
}

void nextlevel()//pretty much same as init()
{
  int i, x, y;
  RGB temppal;
   powertime = 0;
   stuck = 0;
   //init player stuff
   capx = -20; //capsule is off screen
   paddlewidth = 20;
   thepower = 0;
   level++;
   dead = 0;
   px = 140;
   lives += 3;
   score += 2000*level;
   //init ball coords
   bx = 160;
   by = 100;
   bvx = 3;
   bvy = -5;
   //init random number generator
   srand(time(NULL));
   clear(buffer);
   x=10;
   y=20*level;
   if(y > 150) y = 150;
   //initialize all the blocks's positions...
   numhit = 0;
   for (i=0; i<150; i++)
   {
      blocks[i].x = x;
      blocks[i].y = y;
      blocks[i].there = 1;
      x+= 10;
      if(x > 300)
      {
         x = 10;
         y += 5;
      }
   }
   //rotate colors so next level looks interesting
   temppal.r = palt[0].r;
   temppal.g = palt[0].g;
   temppal.b = palt[0].b;
   for (i=0; i<=15; i++)
   {
       palt[i].r = palt[i+1].r;
       palt[i].g = palt[i+1].g;
       palt[i].b = palt[i+1].b;
   }
   palt[16].g = temppal.g;
   palt[16].r = temppal.r;
   palt[16].b = temppal.b;
   set_pallete(palt);
   speed_counter=0;
}

